import type {
  LlmGatewayStored,
  OpenRouterCatalogError,
  OpenRouterCatalogModel,
  OpenRouterCatalogPublic,
} from '@dostigus/shared'
import process from 'node:process'
import {
  defaultBaseUrlForKind,
  emptyOpenRouterShelf,
  inferLlmProviderKind,
  LEGACY_LLM_PROVIDER_ID,
  OPENROUTER_CATALOG_CACHE_MS,
  OPENROUTER_CATALOG_TIMEOUT_MS,
  parseOpenRouterModels,
  rankOpenRouterShelf,
  trimOrUndefined,
} from '@dostigus/shared'
import { gatewayHeaders, llmOutboundFetch } from './llm'

type CatalogEntry = {
  fingerprint: string
  fetchedAt: number
  models: OpenRouterCatalogModel[]
  keyAccepted: boolean | null
}

export type OpenRouterCatalogCache = Map<string, CatalogEntry>

const hostCatalogCache: OpenRouterCatalogCache = new Map()
const inflight = new Map<string, Promise<OpenRouterCatalogPublic>>()

type CatalogProvider = {
  id: string
  kind: string
  apiKey: string | null
  baseUrl: string | null
}

function catalogProvider(stored: LlmGatewayStored, providerId: string): CatalogProvider | null {
  const provider = stored.providers?.find((entry) => entry.id === providerId)
  if (provider) {
    return {
      id: provider.id,
      kind: provider.kind,
      apiKey: trimOrUndefined(provider.apiKey) ?? null,
      baseUrl: defaultBaseUrlForKind(provider.kind, provider.baseUrl),
    }
  }
  if (providerId === LEGACY_LLM_PROVIDER_ID && (stored.providers ?? []).length === 0) {
    const kind = inferLlmProviderKind(stored.baseUrl)
    return {
      id: providerId,
      kind,
      apiKey: trimOrUndefined(stored.apiKey) ?? null,
      baseUrl: defaultBaseUrlForKind(kind, stored.baseUrl),
    }
  }
  return null
}

/** In-memory only, never returned. A new key or base URL misses the cache. */
function fingerprintOf(provider: CatalogProvider): string {
  return `${provider.baseUrl ?? ''}\n${provider.apiKey ?? ''}`
}

function publicFrom(input: {
  providerId: string
  error: OpenRouterCatalogError | null
  keyAccepted: boolean | null
  fetchedAt: number | null
  stale?: boolean
  models?: OpenRouterCatalogModel[]
}): OpenRouterCatalogPublic {
  const models = input.models ?? []
  const ranked = models.length > 0
    ? rankOpenRouterShelf(models)
    : { shelf: emptyOpenRouterShelf(), ranking: 'benchmarks' as const }
  return {
    providerId: input.providerId,
    ok: models.length > 0 && input.keyAccepted !== false,
    error: input.error,
    keyAccepted: input.keyAccepted,
    fetchedAt: input.fetchedAt == null ? null : new Date(input.fetchedAt).toISOString(),
    stale: input.stale ?? false,
    models,
    shelf: ranked.shelf,
    ranking: ranked.ranking,
  }
}

async function probeKey(fetchImpl: typeof fetch, baseUrl: string, apiKey: string): Promise<boolean | null> {
  try {
    const response = await fetchImpl(`${baseUrl}/key`, {
      method: 'GET',
      headers: gatewayHeaders(apiKey),
      signal: AbortSignal.timeout(OPENROUTER_CATALOG_TIMEOUT_MS),
    })
    if (response.ok) {
      return true
    }
    return response.status === 401 || response.status === 403 ? false : null
  } catch {
    return null
  }
}

async function fetchModels(
  fetchImpl: typeof fetch,
  baseUrl: string,
  apiKey: string,
): Promise<{ models: OpenRouterCatalogModel[], error: OpenRouterCatalogError | null }> {
  try {
    const response = await fetchImpl(`${baseUrl}/models`, {
      method: 'GET',
      headers: gatewayHeaders(apiKey),
      signal: AbortSignal.timeout(OPENROUTER_CATALOG_TIMEOUT_MS),
    })
    if (response.status === 401 || response.status === 403) {
      return { models: [], error: 'auth' }
    }
    if (!response.ok) {
      return { models: [], error: 'network' }
    }
    const models = parseOpenRouterModels(await response.json())
    return { models, error: models.length > 0 ? null : 'empty' }
  } catch {
    return { models: [], error: 'network' }
  }
}

/**
 * Owner Settings catalog for one OpenRouter Provider: proxied
 * `GET {base}/models` plus a `GET {base}/key` acceptance probe, with the
 * stored key server-side. About 24h cache; `refresh` bypasses it. An
 * upstream miss serves the last good list as `stale`. Never a Chat gate.
 */
export async function loadOpenRouterCatalog(input: {
  stored: LlmGatewayStored
  providerId: string
  refresh?: boolean
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  now?: () => number
  cache?: OpenRouterCatalogCache
  /** Preview fixture only: skip `GET /key` and treat the key as accepted. */
  trustKey?: boolean
}): Promise<OpenRouterCatalogPublic> {
  const providerId = input.providerId.trim()
  const cache = input.cache ?? hostCatalogCache
  const now = input.now ?? Date.now
  const provider = catalogProvider(input.stored, providerId)
  if (!provider || provider.kind !== 'openrouter' || !provider.baseUrl) {
    return publicFrom({ providerId, error: 'not_openrouter', keyAccepted: null, fetchedAt: null })
  }
  if (!provider.apiKey) {
    return publicFrom({ providerId, error: 'no_key', keyAccepted: null, fetchedAt: null })
  }

  const fingerprint = fingerprintOf(provider)
  const cached = cache.get(providerId)
  const known = cached?.fingerprint === fingerprint ? cached : undefined
  if (known && !input.refresh && now() - known.fetchedAt < OPENROUTER_CATALOG_CACHE_MS) {
    return publicFrom({
      providerId,
      error: null,
      keyAccepted: known.keyAccepted,
      fetchedAt: known.fetchedAt,
      models: known.models,
    })
  }

  const flightKey = `${providerId}\n${fingerprint}`
  const pending = inflight.get(flightKey)
  if (pending) {
    return pending
  }

  const run = (async () => {
    const baseUrl = provider.baseUrl!.replace(/\/$/, '')
    const apiKey = provider.apiKey!
    const fetchImpl = llmOutboundFetch(baseUrl, input.env ?? process.env, input.fetchImpl)
    const [listed, keyAccepted] = await Promise.all([
      fetchModels(fetchImpl, baseUrl, apiKey),
      input.trustKey ? Promise.resolve(true) : probeKey(fetchImpl, baseUrl, apiKey),
    ])
    if (!listed.error && keyAccepted !== false) {
      const fetchedAt = now()
      cache.set(providerId, { fingerprint, fetchedAt, models: listed.models, keyAccepted })
      return publicFrom({ providerId, error: null, keyAccepted, fetchedAt, models: listed.models })
    }
    const error: OpenRouterCatalogError = keyAccepted === false ? 'auth' : (listed.error ?? 'network')
    if (known && keyAccepted !== false) {
      return publicFrom({
        providerId,
        error,
        keyAccepted: known.keyAccepted,
        fetchedAt: known.fetchedAt,
        stale: true,
        models: known.models,
      })
    }
    return publicFrom({
      providerId,
      error,
      keyAccepted,
      fetchedAt: null,
      models: keyAccepted === false ? [] : listed.models,
    })
  })()

  inflight.set(flightKey, run)
  try {
    return await run
  } finally {
    inflight.delete(flightKey)
  }
}
