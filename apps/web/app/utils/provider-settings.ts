import type {
  LlmProviderKind,
  LlmTierBind,
  ModelTier,
  OpenRouterCatalogError,
  OpenRouterCatalogModel,
  OpenRouterCatalogPublic,
  OpenRouterRoutingMode,
} from '@dostigus/shared'
import type { HostLocale } from '@dostigus/ui-kit/locale'
import { LLM_PROVIDER_KIND_LABELS, openRouterRoutingMode } from '@dostigus/shared'
import { DEFAULT_HOST_LOCALE, tHost } from '@dostigus/ui-kit/locale'

/** What each Model tier does for a Bot, in the order the Providers page lists them. */
export function tierSituations(locale: HostLocale = DEFAULT_HOST_LOCALE): ReadonlyArray<{
  tier: ModelTier
  title: string
  detail: string
}> {
  return [
    { tier: 'strong', title: tHost(locale, 'settings.providers.tier.strongTitle'), detail: tHost(locale, 'settings.providers.tier.strongDetail') },
    { tier: 'cheap', title: tHost(locale, 'settings.providers.tier.cheapTitle'), detail: tHost(locale, 'settings.providers.tier.cheapDetail') },
    { tier: 'code', title: tHost(locale, 'settings.providers.tier.codeTitle'), detail: tHost(locale, 'settings.providers.tier.codeDetail') },
    { tier: 'toy', title: tHost(locale, 'settings.providers.tier.toyTitle'), detail: tHost(locale, 'settings.providers.tier.toyDetail') },
  ]
}

export const TIER_SITUATIONS = tierSituations()

export type ProviderHealthTone = 'ok' | 'degraded' | 'error' | 'idle' | 'checking'

export type ProviderHealth = {
  tone: ProviderHealthTone
  title: string
  detail: string
}

export type ProviderHealthInput = {
  providers: ReadonlyArray<{ id: string, kind: LlmProviderKind, hasApiKey: boolean }>
  tierBinds: Partial<Record<ModelTier, LlmTierBind>>
  catalogs: Readonly<Record<string, OpenRouterCatalogPublic | undefined>>
  /** Provider ids whose catalog request is still in flight. */
  loading: ReadonlySet<string>
  /** Manual Check result for a Provider without a live catalog. */
  pings: Readonly<Record<string, boolean | undefined>>
  locale?: HostLocale
}

export function routingModeCopy(
  mode: OpenRouterRoutingMode,
  locale: HostLocale = DEFAULT_HOST_LOCALE,
): string {
  if (mode === 'pinned') {
    return tHost(locale, 'settings.providers.routing.pinned')
  }
  if (mode === 'mixed') {
    return tHost(locale, 'settings.providers.routing.mixed')
  }
  return tHost(locale, 'settings.providers.routing.openrouter')
}

export function catalogErrorCopy(
  error: OpenRouterCatalogError | null,
  locale: HostLocale = DEFAULT_HOST_LOCALE,
): string {
  if (error === 'auth') {
    return tHost(locale, 'settings.providers.catalogError.auth')
  }
  if (error === 'empty') {
    return tHost(locale, 'settings.providers.catalogError.empty')
  }
  if (error === 'no_key') {
    return tHost(locale, 'settings.providers.catalogError.noKey')
  }
  if (error === 'not_openrouter') {
    return tHost(locale, 'settings.providers.catalogError.notOpenrouter')
  }
  return tHost(locale, 'settings.providers.catalogError.generic')
}

function keyCopy(accepted: boolean | null, locale: HostLocale): string {
  if (accepted === true) {
    return tHost(locale, 'settings.providers.key.accepted')
  }
  if (accepted === false) {
    return tHost(locale, 'settings.providers.key.rejected')
  }
  return tHost(locale, 'settings.providers.key.unchecked')
}

function openRouterHealth(
  providerId: string,
  catalog: OpenRouterCatalogPublic,
  binds: Partial<Record<ModelTier, LlmTierBind>>,
  locale: HostLocale,
): ProviderHealth {
  const routing = tHost(locale, 'settings.providers.health.routing', {
    mode: routingModeCopy(openRouterRoutingMode(binds, providerId), locale),
  })
  if (catalog.keyAccepted === false) {
    return {
      tone: 'error',
      title: tHost(locale, 'settings.providers.health.rejectedTitle'),
      detail: tHost(locale, 'settings.providers.health.rejectedDetail'),
    }
  }
  const catalogCopy = catalog.ok && !catalog.stale
    ? tHost(locale, 'settings.providers.health.catalogLoaded')
    : catalog.ok
      ? tHost(locale, 'settings.providers.health.catalogCached')
      : tHost(locale, 'settings.providers.health.catalogFailed')
  const detail = [keyCopy(catalog.keyAccepted, locale), catalogCopy, routing].join(' · ')
  if (catalog.keyAccepted === true && catalog.ok && !catalog.stale) {
    return { tone: 'ok', title: tHost(locale, 'settings.providers.health.ok'), detail }
  }
  return { tone: 'degraded', title: tHost(locale, 'settings.providers.health.degraded'), detail }
}

/**
 * Settings chrome only. Green needs one accepted key plus a soft probe (the
 * catalog, or «Проверить» for a Provider without one). Never a Chat gate.
 */
export function providerHealth(input: ProviderHealthInput): ProviderHealth {
  const locale = input.locale ?? DEFAULT_HOST_LOCALE
  const keyed = input.providers.filter((provider) => provider.hasApiKey)
  if (keyed.length === 0) {
    return {
      tone: 'idle',
      title: tHost(locale, 'settings.providers.health.idleTitle'),
      detail: tHost(locale, 'settings.providers.health.idleDetail'),
    }
  }
  const results: ProviderHealth[] = []
  for (const provider of keyed) {
    if (provider.kind === 'openrouter') {
      const catalog = input.catalogs[provider.id]
      if (catalog) {
        results.push(openRouterHealth(provider.id, catalog, input.tierBinds, locale))
      } else if (input.loading.has(provider.id)) {
        results.push({
          tone: 'checking',
          title: tHost(locale, 'settings.providers.health.checkingTitle'),
          detail: tHost(locale, 'settings.providers.health.checkingDetail'),
        })
      }
      continue
    }
    const ping = input.pings[provider.id]
    const label = LLM_PROVIDER_KIND_LABELS[provider.kind]
    if (ping === true) {
      results.push({
        tone: 'ok',
        title: tHost(locale, 'settings.providers.health.ok'),
        detail: tHost(locale, 'settings.providers.health.openaiOk', { label }),
      })
    } else if (ping === false) {
      results.push({
        tone: 'error',
        title: tHost(locale, 'settings.providers.health.noConnection'),
        detail: tHost(locale, 'settings.providers.health.openaiError', { label }),
      })
    } else {
      results.push({
        tone: 'degraded',
        title: tHost(locale, 'settings.providers.health.keySavedTitle'),
        detail: tHost(locale, 'settings.providers.health.openaiUnchecked', { label }),
      })
    }
  }
  const order: ProviderHealthTone[] = ['ok', 'degraded', 'checking', 'error']
  for (const tone of order) {
    const hit = results.find((result) => result.tone === tone)
    if (hit) {
      return hit
    }
  }
  return {
    tone: 'checking',
    title: tHost(locale, 'settings.providers.health.checkingTitle'),
    detail: tHost(locale, 'settings.providers.health.checkingDetail'),
  }
}

function money(value: number): string {
  if (value === 0) {
    return '$0'
  }
  if (value < 0.01) {
    return `$${value.toFixed(3)}`
  }
  return `$${value < 10 ? value.toFixed(2) : value.toFixed(0)}`
}

/** `$0.43 / $0.87` per 1M tokens (in / out), or «Бесплатно». */
export function modelPriceCopy(
  model: Pick<OpenRouterCatalogModel, 'free' | 'promptPerM' | 'completionPerM'>,
  locale: HostLocale = DEFAULT_HOST_LOCALE,
): string {
  if (model.free) {
    return tHost(locale, 'settings.providers.price.free')
  }
  if (model.promptPerM == null || model.completionPerM == null) {
    return tHost(locale, 'settings.providers.price.onRequest')
  }
  return `${money(model.promptPerM)} / ${money(model.completionPerM)}`
}

export function contextCopy(tokens: number | null, locale: HostLocale = DEFAULT_HOST_LOCALE): string {
  if (!tokens) {
    return ''
  }
  if (tokens >= 1_000_000) {
    return tHost(locale, 'settings.providers.context.m', { n: Math.round(tokens / 100_000) / 10 })
  }
  return tHost(locale, 'settings.providers.context.k', { n: Math.round(tokens / 1000) })
}

/** Short Policy text for one Model tier bind. Pinned ids show the catalog name when known. */
export function bindCopy(
  bind: LlmTierBind | undefined,
  providers: ReadonlyArray<{ id: string, kind: LlmProviderKind }>,
  names: Readonly<Record<string, string>> = {},
): { provider: string, policy: string, pinned: boolean } | null {
  if (!bind) {
    return null
  }
  const provider = providers.find((entry) => entry.id === bind.providerId)
  const providerLabel = provider ? LLM_PROVIDER_KIND_LABELS[provider.kind] : 'Provider'
  if (bind.policy.kind === 'free') {
    return { provider: providerLabel, policy: 'Free', pinned: false }
  }
  if (bind.policy.kind === 'auto') {
    return { provider: providerLabel, policy: 'Auto', pinned: false }
  }
  return { provider: providerLabel, policy: names[bind.policy.modelId] ?? bind.policy.modelId, pinned: true }
}

/** Case-insensitive match on name or id; every word must hit. */
export function searchCatalogModels(
  models: readonly OpenRouterCatalogModel[],
  query: string,
): OpenRouterCatalogModel[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return [...models]
  }
  return models.filter((model) => {
    const haystack = `${model.name} ${model.id}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}

export function fetchedAtCopy(
  iso: string | null,
  now: Date = new Date(),
  locale: HostLocale = DEFAULT_HOST_LOCALE,
): string {
  if (!iso) {
    return ''
  }
  const at = new Date(iso)
  const minutes = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000))
  if (minutes < 1) {
    return tHost(locale, 'settings.providers.fetched.justNow')
  }
  if (minutes < 60) {
    return tHost(locale, 'settings.providers.fetched.minutes', { n: minutes })
  }
  const hours = Math.round(minutes / 60)
  return tHost(locale, 'settings.providers.fetched.hours', { n: hours })
}
