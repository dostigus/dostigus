import { expect, it } from 'vitest'
import {
  autoFillEmptyTiers,
  emptyLlmGatewayStored,
  ESCALATE_CHAIN,
  inferLlmProviderKind,
  LLM_TIER_ATTEMPTS_MAX,
  OPENAI_DEFAULT_BASE_URL,
  OPENROUTER_AUTO_MODEL_ID,
  OPENROUTER_DEFAULT_BASE_URL,
  OPENROUTER_FREE_MODEL_ID,
  planEscalateAttempts,
  resolveLlmAttempt,
  resolveModelId,
  startTierForSituation,
} from '../../src/index'

it('starts Chat on strong and Wake on cheap, never code', () => {
  expect(startTierForSituation('chat')).toBe('strong')
  expect(startTierForSituation('user')).toBe('strong')
  expect(startTierForSituation('mention')).toBe('strong')
  expect(startTierForSituation('wake')).toBe('cheap')
  expect(ESCALATE_CHAIN).toEqual(['cheap', 'strong', 'code'])
  expect(ESCALATE_CHAIN).not.toContain('toy')
  expect(LLM_TIER_ATTEMPTS_MAX).toBe(3)
})

it('infers Provider kind from the base URL', () => {
  expect(inferLlmProviderKind(null)).toBe('openrouter')
  expect(inferLlmProviderKind(OPENROUTER_DEFAULT_BASE_URL)).toBe('openrouter')
  expect(inferLlmProviderKind(OPENAI_DEFAULT_BASE_URL)).toBe('openai')
  expect(inferLlmProviderKind('https://example.test/v1')).toBe('openai-compatible')
})

it('reads legacy openrouter/free pins on every Model tier', () => {
  const stored = {
    ...emptyLlmGatewayStored(),
    baseUrl: OPENROUTER_DEFAULT_BASE_URL,
    providers: [{
      id: 'legacy',
      kind: 'openrouter' as const,
      apiKey: 'sk-legacy',
      baseUrl: OPENROUTER_DEFAULT_BASE_URL,
      defaultModel: null,
    }],
    modelOverrides: {
      cheap: OPENROUTER_FREE_MODEL_ID,
      strong: OPENROUTER_FREE_MODEL_ID,
      code: OPENROUTER_FREE_MODEL_ID,
      toy: OPENROUTER_FREE_MODEL_ID,
    },
  }
  for (const tier of ['cheap', 'strong', 'code', 'toy'] as const) {
    const attempt = resolveLlmAttempt(tier, { stored })
    expect(attempt?.modelId).toBe(OPENROUTER_FREE_MODEL_ID)
    expect(attempt?.kind).toBe('openrouter')
    expect(resolveModelId(tier, { stored })).toBe(OPENROUTER_FREE_MODEL_ID)
  }
  const plan = planEscalateAttempts('strong', { stored })
  expect(plan).toHaveLength(1)
  expect(plan[0]?.modelId).toBe(OPENROUTER_FREE_MODEL_ID)
})

it('auto-fills empty OpenRouter tiers with free and auto Policies', () => {
  const provider = {
    id: 'or1',
    kind: 'openrouter' as const,
    apiKey: 'sk-or',
    baseUrl: OPENROUTER_DEFAULT_BASE_URL,
    defaultModel: null,
  }
  const binds = autoFillEmptyTiers({
    provider,
    binds: {},
    pins: { cheap: OPENROUTER_FREE_MODEL_ID },
  })
  expect(binds.cheap).toBeUndefined()
  expect(binds.toy).toEqual({ providerId: 'or1', policy: { kind: 'free' } })
  expect(binds.strong).toEqual({ providerId: 'or1', policy: { kind: 'auto' } })
  expect(binds.code).toEqual({ providerId: 'or1', policy: { kind: 'auto' } })
})

it('resolves OpenRouter Policies to verified meta slugs', () => {
  const stored = {
    ...emptyLlmGatewayStored(),
    providers: [{
      id: 'or1',
      kind: 'openrouter' as const,
      apiKey: 'sk-or',
      baseUrl: null,
      defaultModel: null,
    }],
    tierBinds: {
      cheap: { providerId: 'or1', policy: { kind: 'free' as const } },
      strong: { providerId: 'or1', policy: { kind: 'auto' as const } },
      code: { providerId: 'or1', policy: { kind: 'auto' as const } },
      toy: { providerId: 'or1', policy: { kind: 'free' as const } },
    },
  }
  expect(resolveLlmAttempt('cheap', { stored })?.modelId).toBe(OPENROUTER_FREE_MODEL_ID)
  expect(resolveLlmAttempt('strong', { stored })?.modelId).toBe(OPENROUTER_AUTO_MODEL_ID)
  const chat = planEscalateAttempts('strong', { stored })
  expect(chat.map((attempt) => attempt.modelTier)).toEqual(['strong'])
  const wake = planEscalateAttempts('cheap', { stored })
  expect(wake.map((attempt) => `${attempt.modelTier}:${attempt.modelId}`)).toEqual([
    `cheap:${OPENROUTER_FREE_MODEL_ID}`,
    `strong:${OPENROUTER_AUTO_MODEL_ID}`,
  ])
})

it('skips unset tiers and the same Provider plus model on escalate', () => {
  const stored = {
    ...emptyLlmGatewayStored(),
    providers: [
      {
        id: 'a',
        kind: 'openai' as const,
        apiKey: 'sk-a',
        baseUrl: OPENAI_DEFAULT_BASE_URL,
        defaultModel: 'gpt-4o-mini',
      },
      {
        id: 'b',
        kind: 'openai' as const,
        apiKey: 'sk-b',
        baseUrl: OPENAI_DEFAULT_BASE_URL,
        defaultModel: 'gpt-4o',
      },
    ],
    tierBinds: {
      cheap: { providerId: 'a', policy: { kind: 'model' as const, modelId: 'gpt-4o-mini' } },
      strong: { providerId: 'a', policy: { kind: 'model' as const, modelId: 'gpt-4o-mini' } },
      code: { providerId: 'b', policy: { kind: 'model' as const, modelId: 'gpt-4o' } },
    },
  }
  const plan = planEscalateAttempts('cheap', { stored })
  expect(plan.map((attempt) => attempt.attemptKey)).toEqual(['a::gpt-4o-mini', 'b::gpt-4o'])
  expect(plan).toHaveLength(2)
})

it('shares one model across tiers for a sole OpenAI Provider', () => {
  const provider = {
    id: 'oa',
    kind: 'openai' as const,
    apiKey: 'sk-oa',
    baseUrl: null,
    defaultModel: 'gpt-4o',
  }
  const binds = autoFillEmptyTiers({ provider, binds: {} })
  expect(binds.cheap?.policy).toEqual({ kind: 'model', modelId: 'gpt-4o' })
  expect(binds.strong?.policy).toEqual({ kind: 'model', modelId: 'gpt-4o' })
  const stored = {
    ...emptyLlmGatewayStored(),
    providers: [provider],
    tierBinds: binds,
  }
  const plan = planEscalateAttempts('strong', { stored })
  expect(plan).toHaveLength(1)
  expect(plan[0]?.baseUrl).toBe(OPENAI_DEFAULT_BASE_URL)
})
