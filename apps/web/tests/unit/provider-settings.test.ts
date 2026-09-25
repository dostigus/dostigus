import type { LlmTierBind, ModelTier, OpenRouterCatalogPublic } from '@dostigus/shared'
import { emptyOpenRouterShelf } from '@dostigus/shared'
import { describe, expect, it } from 'vitest'
import {
  bindCopy,
  contextCopy,
  fetchedAtCopy,
  modelPriceCopy,
  providerHealth,
  searchCatalogModels,
  TIER_SITUATIONS,
} from '../../app/utils/provider-settings'

const openrouter = [{ id: 'or', kind: 'openrouter' as const, hasApiKey: true }]

const meta: Partial<Record<ModelTier, LlmTierBind>> = {
  cheap: { providerId: 'or', policy: { kind: 'free' } },
  toy: { providerId: 'or', policy: { kind: 'free' } },
  strong: { providerId: 'or', policy: { kind: 'auto' } },
  code: { providerId: 'or', policy: { kind: 'auto' } },
}

function catalog(overrides: Partial<OpenRouterCatalogPublic> = {}): OpenRouterCatalogPublic {
  return {
    providerId: 'or',
    ok: true,
    error: null,
    keyAccepted: true,
    fetchedAt: '2026-09-25T10:00:00.000Z',
    stale: false,
    models: [],
    shelf: emptyOpenRouterShelf(),
    ranking: 'benchmarks',
    ...overrides,
  }
}

function health(input: Partial<Parameters<typeof providerHealth>[0]> = {}) {
  return providerHealth({
    providers: openrouter,
    tierBinds: meta,
    catalogs: {},
    loading: new Set(),
    pings: {},
    ...input,
  })
}

describe('providerHealth', () => {
  it('is idle with no Provider key', () => {
    expect(health({ providers: [] }).tone).toBe('idle')
    expect(health({ providers: [{ id: 'or', kind: 'openrouter', hasApiKey: false }] }).tone).toBe('idle')
  })

  it('is green only when the key is accepted and the catalog loaded', () => {
    const ok = health({ catalogs: { or: catalog() } })
    expect(ok.tone).toBe('ok')
    expect(ok.detail).toBe('Ключ принят · каталог загружен · маршрутизация: OpenRouter')
  })

  it('shows the routing mode once a shelf pin lands', () => {
    const binds = { ...meta, strong: { providerId: 'or', policy: { kind: 'model' as const, modelId: 'lab/smart' } } }
    expect(health({ tierBinds: binds, catalogs: { or: catalog() } }).detail)
      .toContain('маршрутизация: OpenRouter + закреплённые модели')
  })

  it('degrades, not blocks, when the soft probe misses', () => {
    expect(health({ catalogs: { or: catalog({ ok: false, error: 'network', keyAccepted: null }) } }).tone).toBe('degraded')
    expect(health({ catalogs: { or: catalog({ stale: true }) } }).detail).toContain('каталог из кэша')
    expect(health({ loading: new Set(['or']) }).tone).toBe('checking')
  })

  it('is red when OpenRouter rejects the key', () => {
    expect(health({ catalogs: { or: catalog({ ok: false, error: 'auth', keyAccepted: false }) } }).tone).toBe('error')
  })

  it('uses «Проверить» for a Provider without a live catalog', () => {
    const openai = [{ id: 'oa', kind: 'openai' as const, hasApiKey: true }]
    expect(health({ providers: openai }).tone).toBe('degraded')
    expect(health({ providers: openai, pings: { oa: true } }).tone).toBe('ok')
    expect(health({ providers: openai, pings: { oa: false } }).tone).toBe('error')
  })

  it('prefers any working Provider over a broken one', () => {
    const both = [...openrouter, { id: 'oa', kind: 'openai' as const, hasApiKey: true }]
    expect(health({
      providers: both,
      catalogs: { or: catalog({ ok: false, error: 'auth', keyAccepted: false }) },
      pings: { oa: true },
    }).tone).toBe('ok')
  })
})

describe('copy helpers', () => {
  it('lists every Model tier once, Chat first', () => {
    expect(TIER_SITUATIONS.map((row) => row.tier)).toEqual(['strong', 'cheap', 'code', 'toy'])
  })

  it('formats price per 1M tokens and context', () => {
    expect(modelPriceCopy({ free: true, promptPerM: 0, completionPerM: 0 })).toBe('Бесплатно')
    expect(modelPriceCopy({ free: false, promptPerM: 0.43, completionPerM: 0.87 })).toBe('$0.43 / $0.87')
    expect(modelPriceCopy({ free: false, promptPerM: 0.004, completionPerM: 15 })).toBe('$0.004 / $15')
    expect(modelPriceCopy({ free: false, promptPerM: null, completionPerM: null })).toBe('Цена по запросу')
    expect(contextCopy(262_144)).toBe('262K контекст')
    expect(contextCopy(1_048_576)).toBe('1M контекст')
    expect(contextCopy(null)).toBe('')
  })

  it('names a pinned bind from the catalog', () => {
    const providers = [{ id: 'or', kind: 'openrouter' as const }]
    expect(bindCopy(meta.strong, providers)).toEqual({ provider: 'OpenRouter', policy: 'Auto', pinned: false })
    expect(bindCopy({ providerId: 'or', policy: { kind: 'model', modelId: 'lab/x' } }, providers, { 'lab/x': 'Lab X' }))
      .toEqual({ provider: 'OpenRouter', policy: 'Lab X', pinned: true })
    expect(bindCopy(undefined, providers)).toBeNull()
  })

  it('searches name and id with every word', () => {
    const models = [
      { id: 'lab/alpha-mini', name: 'Lab: Alpha Mini' },
      { id: 'other/beta', name: 'Other: Beta' },
    ] as Parameters<typeof searchCatalogModels>[0]
    expect(searchCatalogModels(models, 'alpha mini').map((model) => model.id)).toEqual(['lab/alpha-mini'])
    expect(searchCatalogModels(models, 'OTHER/').map((model) => model.id)).toEqual(['other/beta'])
    expect(searchCatalogModels(models, '  ')).toHaveLength(2)
  })

  it('says how old the catalog is', () => {
    const now = new Date('2026-09-25T12:00:00.000Z')
    expect(fetchedAtCopy('2026-09-25T12:00:00.000Z', now)).toBe('обновлено только что')
    expect(fetchedAtCopy('2026-09-25T11:45:00.000Z', now)).toBe('обновлено 15 мин назад')
    expect(fetchedAtCopy('2026-09-25T09:00:00.000Z', now)).toBe('обновлено 3 ч назад')
    expect(fetchedAtCopy(null, now)).toBe('')
  })
})
