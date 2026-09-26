import type { LlmGatewayStored } from '@dostigus/shared'
import type { OpenRouterCatalogCache } from '../../server/utils/openrouter-catalog'
import { OPENROUTER_CATALOG_CACHE_MS } from '@dostigus/shared'
import { ProxyAgent } from 'undici'
import { describe, expect, it } from 'vitest'
import { loadOpenRouterCatalog } from '../../server/utils/openrouter-catalog'

const KEY = 'sk-or-v1-secret-value'

function stored(overrides: Partial<LlmGatewayStored> = {}): LlmGatewayStored {
  return {
    baseUrl: null,
    defaultTier: 'strong',
    modelOverrides: {},
    providers: [{ id: 'or1', kind: 'openrouter', apiKey: KEY, baseUrl: null, defaultModel: null }],
    tierBinds: {},
    ...overrides,
  }
}

const MODELS = {
  data: [
    {
      id: 'lab/free',
      name: 'Lab Free',
      architecture: { modality: 'text+image->text', output_modalities: ['text'] },
      pricing: { prompt: '0', completion: '0' },
      supported_parameters: ['tools'],
      benchmarks: { artificial_analysis: { intelligence_index: 20 } },
    },
    {
      id: 'lab/smart',
      name: 'Lab Smart',
      architecture: { modality: 'text->text', output_modalities: ['text'] },
      pricing: { prompt: '0.000001', completion: '0.000002' },
      supported_parameters: ['tools'],
      benchmarks: { artificial_analysis: { intelligence_index: 40, coding_index: 60 } },
    },
  ],
}

type Call = { url: string, auth: string | null, dispatcher: unknown }

function fakeFetch(options: { models?: number | 'throw', key?: number } = {}) {
  const calls: Call[] = []
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    calls.push({
      url: String(input),
      auth: headers.get('authorization'),
      dispatcher: (init as { dispatcher?: unknown } | undefined)?.dispatcher,
    })
    if (String(input).endsWith('/key')) {
      const status = options.key ?? 200
      return new Response(JSON.stringify({ data: {} }), { status })
    }
    if (options.models === 'throw') {
      throw new Error('network down')
    }
    const status = options.models ?? 200
    return new Response(status === 200 ? JSON.stringify(MODELS) : '{}', { status })
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

describe('loadOpenRouterCatalog', () => {
  it('proxies /models and /key with the stored key and never returns it', async () => {
    const cache: OpenRouterCatalogCache = new Map()
    const { calls, fetchImpl } = fakeFetch()
    const catalog = await loadOpenRouterCatalog({ stored: stored(), providerId: 'or1', fetchImpl, cache, env: {} })
    expect(catalog.ok).toBe(true)
    expect(catalog.keyAccepted).toBe(true)
    expect(catalog.models.map((model) => model.id)).toEqual(['lab/free', 'lab/smart'])
    expect(catalog.shelf.free[0]?.id).toBe('lab/free')
    expect(catalog.shelf.smart[0]?.id).toBe('lab/smart')
    expect(catalog.models[0]?.vision).toBe(true)
    expect(calls.map((call) => call.url).sort()).toEqual([
      'https://openrouter.ai/api/v1/key',
      'https://openrouter.ai/api/v1/models',
    ])
    expect(calls.every((call) => call.auth === `Bearer ${KEY}`)).toBe(true)
    expect(JSON.stringify(catalog)).not.toContain(KEY)
  })

  it('serves the cache for about 24h and refetches on refresh or a new key', async () => {
    const cache: OpenRouterCatalogCache = new Map()
    let now = 1_000
    const { calls, fetchImpl } = fakeFetch()
    const load = (refresh = false, gateway = stored()) => loadOpenRouterCatalog({
      stored: gateway,
      providerId: 'or1',
      fetchImpl,
      cache,
      env: {},
      refresh,
      now: () => now,
    })
    await load()
    expect(calls).toHaveLength(2)
    now += OPENROUTER_CATALOG_CACHE_MS - 1
    const hit = await load()
    expect(calls).toHaveLength(2)
    expect(hit.fetchedAt).toBe(new Date(1_000).toISOString())
    await load(true)
    expect(calls).toHaveLength(4)
    now += OPENROUTER_CATALOG_CACHE_MS
    await load()
    expect(calls).toHaveLength(6)
    await load(false, stored({
      providers: [{ id: 'or1', kind: 'openrouter', apiKey: 'sk-new', baseUrl: null, defaultModel: null }],
    }))
    expect(calls).toHaveLength(8)
  })

  it('serves the last good list as stale when upstream fails', async () => {
    const cache: OpenRouterCatalogCache = new Map()
    await loadOpenRouterCatalog({ stored: stored(), providerId: 'or1', fetchImpl: fakeFetch().fetchImpl, cache, env: {} })
    const miss = await loadOpenRouterCatalog({
      stored: stored(),
      providerId: 'or1',
      fetchImpl: fakeFetch({ models: 'throw' }).fetchImpl,
      cache,
      env: {},
      refresh: true,
    })
    expect(miss).toMatchObject({ ok: true, stale: true, error: 'network' })
    expect(miss.models).toHaveLength(2)
  })

  it('reports a cache miss plus upstream error as a soft failure', async () => {
    const catalog = await loadOpenRouterCatalog({
      stored: stored(),
      providerId: 'or1',
      fetchImpl: fakeFetch({ models: 503, key: 500 }).fetchImpl,
      cache: new Map(),
      env: {},
    })
    expect(catalog).toMatchObject({ ok: false, error: 'network', keyAccepted: null, models: [] })
  })

  it('reports a rejected key even though the public list answered', async () => {
    const catalog = await loadOpenRouterCatalog({
      stored: stored(),
      providerId: 'or1',
      fetchImpl: fakeFetch({ key: 401 }).fetchImpl,
      cache: new Map(),
      env: {},
    })
    expect(catalog).toMatchObject({ ok: false, error: 'auth', keyAccepted: false, models: [] })
  })

  it('answers only for an OpenRouter Provider with a stored key', async () => {
    const { calls, fetchImpl } = fakeFetch()
    const other = await loadOpenRouterCatalog({
      stored: stored({
        providers: [{ id: 'oa', kind: 'openai', apiKey: KEY, baseUrl: null, defaultModel: null }],
      }),
      providerId: 'oa',
      fetchImpl,
      cache: new Map(),
      env: {},
    })
    expect(other.error).toBe('not_openrouter')
    const missing = await loadOpenRouterCatalog({ stored: stored(), providerId: 'nope', fetchImpl, cache: new Map(), env: {} })
    expect(missing.error).toBe('not_openrouter')
    const keyless = await loadOpenRouterCatalog({
      stored: stored({
        providers: [{ id: 'or1', kind: 'openrouter', apiKey: null, baseUrl: null, defaultModel: null }],
      }),
      providerId: 'or1',
      fetchImpl,
      cache: new Map(),
      env: {},
    })
    expect(keyless.error).toBe('no_key')
    expect(calls).toHaveLength(0)
  })

  it('reads Provider legacy from providers_json only', async () => {
    const catalog = await loadOpenRouterCatalog({
      stored: stored({
        providers: [{ id: 'legacy', kind: 'openrouter', apiKey: KEY, baseUrl: null, defaultModel: null }],
      }),
      providerId: 'legacy',
      fetchImpl: fakeFetch().fetchImpl,
      cache: new Map(),
      env: {},
    })
    expect(catalog.ok).toBe(true)
  })

  it('uses the LLM-path proxy, not the Bot HTTP proxy', async () => {
    const { calls, fetchImpl } = fakeFetch()
    await loadOpenRouterCatalog({
      stored: stored(),
      providerId: 'or1',
      fetchImpl,
      cache: new Map(),
      env: { HTTPS_PROXY: 'http://proxy.test:8080', DOSTIGUS_HTTP_PROXY: 'http://bot.test:1' },
    })
    expect(calls[0]?.dispatcher).toBeInstanceOf(ProxyAgent)
  })
})
