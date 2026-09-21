import { expect, it } from 'vitest'
import {
  chatSystemPrompt,
  DEFAULT_MODEL_TIER,
  DEFAULT_TIER_MODELS,
  emptyLlmGatewayStored,
  isLlmGatewayConfigured,
  maskApiKey,
  OPENROUTER_DEFAULT_BASE_URL,
  readLlmGatewayEnv,
  redactSecrets,
  resolveLlmGateway,
  resolveModelId,
  toPublicLlmGateway,
} from '../../src/index'

it('maps Model tiers to OpenRouter-friendly default model ids', () => {
  expect(DEFAULT_TIER_MODELS).toEqual({
    cheap: 'openai/gpt-4o-mini',
    strong: 'openai/gpt-4o',
    code: 'openai/gpt-4o',
    toy: 'openai/gpt-4o-mini',
  })
  expect(resolveModelId('strong')).toBe('openai/gpt-4o')
  expect(resolveModelId('cheap')).toBe('openai/gpt-4o-mini')
  expect(resolveModelId('code', {
    env: { model: 'openai/gpt-4o' },
  })).toBe('openai/gpt-4o')
  expect(resolveModelId('cheap', {
    env: { modelOverrides: { cheap: 'openai/gpt-4.1-mini' } },
  })).toBe('openai/gpt-4.1-mini')
  expect(resolveModelId('toy', {
    stored: {
      ...emptyLlmGatewayStored(),
      modelOverrides: { toy: 'openrouter/free' },
    },
  })).toBe('openrouter/free')
})

it('treats missing key as an unconfigured LLM gateway', () => {
  expect(isLlmGatewayConfigured({})).toBe(false)
  expect(isLlmGatewayConfigured({
    OPENAI_COMPATIBLE_BASE_URL: OPENROUTER_DEFAULT_BASE_URL,
  })).toBe(false)
  expect(resolveLlmGateway(readLlmGatewayEnv({})).configured).toBe(false)
})

it('reads OpenAI-compatible env and treats env as override over Store', () => {
  const env = readLlmGatewayEnv({
    OPENAI_COMPATIBLE_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_API_KEY: 'sk-env',
    LLM_MODEL: 'openai/gpt-4o',
    LLM_DEFAULT_TIER: 'cheap',
    LLM_MODEL_CODE: 'openai/gpt-4.1',
  })
  expect(env).toEqual({
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-env',
    model: 'openai/gpt-4o',
    defaultTier: 'cheap',
    modelOverrides: { code: 'openai/gpt-4.1' },
  })

  const stored = {
    baseUrl: 'https://store.example/v1',
    apiKey: 'sk-store',
    defaultTier: DEFAULT_MODEL_TIER,
    modelOverrides: { cheap: 'store-cheap' },
  }
  const resolved = resolveLlmGateway(env, stored)
  expect(resolved.configured).toBe(true)
  expect(resolved.envOverride).toBe(true)
  expect(resolved.source).toBe('merged')
  expect(resolved.baseUrl).toBe('https://openrouter.ai/api/v1')
  expect(resolved.apiKey).toBe('sk-env')
  expect(resolved.defaultTier).toBe('cheap')
  expect(resolved.modelIdFor('strong')).toBe('openai/gpt-4o')
})

it('uses Store settings when env is unset, defaulting the base to OpenRouter', () => {
  const resolved = resolveLlmGateway(readLlmGatewayEnv({}), {
    baseUrl: null,
    apiKey: 'sk-store',
    defaultTier: 'code',
    modelOverrides: {},
  })
  expect(resolved.configured).toBe(true)
  expect(resolved.baseUrl).toBe(OPENROUTER_DEFAULT_BASE_URL)
  expect(resolved.apiKey).toBe('sk-store')
  expect(resolved.source).toBe('store')
  expect(resolved.envOverride).toBe(false)
})

it('never returns the full key from mask or public JSON', () => {
  const key = 'sk-or-v1-abcdefghijklmnopqrstuvwxyz'
  expect(maskApiKey(key)).toBe('••••wxyz')
  expect(maskApiKey(key)?.includes(key)).toBe(false)
  expect(redactSecrets(`Bearer ${key} failed`, [key])).toBe('Bearer [redacted] failed')

  const resolved = resolveLlmGateway(readLlmGatewayEnv({}), {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: key,
    defaultTier: 'strong',
    modelOverrides: {},
  })
  const pub = toPublicLlmGateway({
    resolved,
    stored: {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: key,
      defaultTier: 'strong',
      modelOverrides: {},
    },
  })
  expect(pub.hasApiKey).toBe(true)
  expect(pub.hasStoredApiKey).toBe(true)
  expect(pub.apiKeyMasked).toBe('••••wxyz')
  expect(JSON.stringify(pub).includes(key)).toBe(false)
  expect(pub).not.toHaveProperty('apiKey')
})

it('asks a new Bot to learn its purpose and keep the Manifest', () => {
  expect(chatSystemPrompt({
    botName: 'New Bot',
    manifest: {
      name: 'New Bot',
      modelTier: 'strong',
      skillIds: [],
      modulePackageIds: [],
    },
  })).toContain('You are new. Ask and learn what this Bot is for.')
})
