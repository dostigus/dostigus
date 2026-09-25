import type {
  LlmProviderKind,
  LlmTierBind,
  ModelTier,
  OpenRouterCatalogError,
  OpenRouterCatalogModel,
  OpenRouterCatalogPublic,
  OpenRouterRoutingMode,
} from '@dostigus/shared'
import { LLM_PROVIDER_KIND_LABELS, openRouterRoutingMode } from '@dostigus/shared'

/** What each Model tier does for a Bot, in the order the Providers page lists them. */
export const TIER_SITUATIONS: ReadonlyArray<{ tier: ModelTier, title: string, detail: string }> = [
  { tier: 'strong', title: 'Chat и упоминания', detail: 'Каждый ответ Bot в Chat начинается здесь.' },
  { tier: 'cheap', title: 'Wake и Schedules', detail: 'Сообщения по расписанию начинаются здесь.' },
  { tier: 'code', title: 'Если ответ не вышел', detail: 'Host тихо пробует ещё раз на этом Model tier.' },
  { tier: 'toy', title: 'Песочница', detail: 'Только для экспериментов, вне цепочки.' },
]

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
  /** Manual «Проверить» result for a Provider without a live catalog. */
  pings: Readonly<Record<string, boolean | undefined>>
}

export function routingModeCopy(mode: OpenRouterRoutingMode): string {
  if (mode === 'pinned') {
    return 'закреплённые модели'
  }
  if (mode === 'mixed') {
    return 'OpenRouter + закреплённые модели'
  }
  return 'OpenRouter'
}

export function catalogErrorCopy(error: OpenRouterCatalogError | null): string {
  if (error === 'auth') {
    return 'OpenRouter не принял ключ.'
  }
  if (error === 'empty') {
    return 'OpenRouter вернул пустой список моделей.'
  }
  if (error === 'no_key') {
    return 'У этого Provider нет ключа.'
  }
  if (error === 'not_openrouter') {
    return 'Каталог есть только у OpenRouter.'
  }
  return 'Не удалось загрузить каталог OpenRouter.'
}

function keyCopy(accepted: boolean | null): string {
  if (accepted === true) {
    return 'Ключ принят'
  }
  if (accepted === false) {
    return 'Ключ не принят'
  }
  return 'Ключ не проверен'
}

function openRouterHealth(
  providerId: string,
  catalog: OpenRouterCatalogPublic,
  binds: Partial<Record<ModelTier, LlmTierBind>>,
): ProviderHealth {
  const routing = `маршрутизация: ${routingModeCopy(openRouterRoutingMode(binds, providerId))}`
  if (catalog.keyAccepted === false) {
    return {
      tone: 'error',
      title: 'Ключ не принят',
      detail: 'OpenRouter отклонил ключ. Вставьте новый, и Bots снова смогут думать.',
    }
  }
  const catalogCopy = catalog.ok && !catalog.stale
    ? 'каталог загружен'
    : catalog.ok
      ? 'каталог из кэша'
      : 'каталог не загрузился'
  const detail = [keyCopy(catalog.keyAccepted), catalogCopy, routing].join(' · ')
  if (catalog.keyAccepted === true && catalog.ok && !catalog.stale) {
    return { tone: 'ok', title: 'Работает', detail }
  }
  return { tone: 'degraded', title: 'Работает, но не всё проверено', detail }
}

/**
 * Settings chrome only. Green needs one accepted key plus a soft probe (the
 * catalog, or «Проверить» for a Provider without one). Never a Chat gate.
 */
export function providerHealth(input: ProviderHealthInput): ProviderHealth {
  const keyed = input.providers.filter((provider) => provider.hasApiKey)
  if (keyed.length === 0) {
    return {
      tone: 'idle',
      title: 'Нет Provider',
      detail: 'Bots отвечают тихой заглушкой, пока нет ключа.',
    }
  }
  const results: ProviderHealth[] = []
  for (const provider of keyed) {
    if (provider.kind === 'openrouter') {
      const catalog = input.catalogs[provider.id]
      if (catalog) {
        results.push(openRouterHealth(provider.id, catalog, input.tierBinds))
      } else if (input.loading.has(provider.id)) {
        results.push({ tone: 'checking', title: 'Проверяем…', detail: 'Загружаем каталог OpenRouter.' })
      }
      continue
    }
    const ping = input.pings[provider.id]
    const label = LLM_PROVIDER_KIND_LABELS[provider.kind]
    if (ping === true) {
      results.push({ tone: 'ok', title: 'Работает', detail: `${label} · соединение проверено` })
    } else if (ping === false) {
      results.push({ tone: 'error', title: 'Нет соединения', detail: `${label} не ответил. Проверьте ключ и адрес.` })
    } else {
      results.push({ tone: 'degraded', title: 'Ключ сохранён', detail: `${label} · нажмите «Проверить», чтобы убедиться` })
    }
  }
  const order: ProviderHealthTone[] = ['ok', 'degraded', 'checking', 'error']
  for (const tone of order) {
    const hit = results.find((result) => result.tone === tone)
    if (hit) {
      return hit
    }
  }
  return { tone: 'checking', title: 'Проверяем…', detail: 'Загружаем каталог OpenRouter.' }
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
export function modelPriceCopy(model: Pick<OpenRouterCatalogModel, 'free' | 'promptPerM' | 'completionPerM'>): string {
  if (model.free) {
    return 'Бесплатно'
  }
  if (model.promptPerM == null || model.completionPerM == null) {
    return 'Цена по запросу'
  }
  return `${money(model.promptPerM)} / ${money(model.completionPerM)}`
}

export function contextCopy(tokens: number | null): string {
  if (!tokens) {
    return ''
  }
  if (tokens >= 1_000_000) {
    return `${Math.round(tokens / 100_000) / 10}M контекст`
  }
  return `${Math.round(tokens / 1000)}K контекст`
}

/** Short Policy text for one Model tier bind. Pinned ids show the catalog name when known. */
export function bindCopy(
  bind: LlmTierBind | undefined,
  providers: ReadonlyArray<{ id: string, kind: LlmProviderKind }>,
  names: Readonly<Record<string, string>> = {},
): { provider: string, policy: string } | null {
  if (!bind) {
    return null
  }
  const provider = providers.find((entry) => entry.id === bind.providerId)
  const providerLabel = provider ? LLM_PROVIDER_KIND_LABELS[provider.kind] : 'Provider'
  if (bind.policy.kind === 'free') {
    return { provider: providerLabel, policy: 'маршрутизация Free' }
  }
  if (bind.policy.kind === 'auto') {
    return { provider: providerLabel, policy: 'маршрутизация Auto' }
  }
  return { provider: providerLabel, policy: names[bind.policy.modelId] ?? bind.policy.modelId }
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

export function fetchedAtCopy(iso: string | null, now: Date = new Date()): string {
  if (!iso) {
    return ''
  }
  const at = new Date(iso)
  const minutes = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000))
  if (minutes < 1) {
    return 'обновлено только что'
  }
  if (minutes < 60) {
    return `обновлено ${minutes} мин назад`
  }
  const hours = Math.round(minutes / 60)
  return `обновлено ${hours} ч назад`
}
