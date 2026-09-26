import { expect, it } from 'vitest'
import {
  baseUrlForLlmGatewayPreset,
  CHAT_HTTP_GET_HINT,
  CHAT_NO_PACKAGE_RULE,
  CHAT_SELF_SETTINGS_RULE,
  chatSystemPrompt,
  DEFAULT_MODEL_TIER,
  DEFAULT_TIER_MODELS,
  emptyLlmGatewayStored,
  isLlmGatewayConfigured,
  LLM_GATEWAY_AUTH_ERROR_REPLY,
  LLM_GATEWAY_EMPTY_ERROR_REPLY,
  LLM_GATEWAY_RETRY_BACKOFF_MS,
  LLM_GATEWAY_TRANSIENT_ERROR_REPLY,
  llmGatewayErrorReply,
  llmGatewayPresetFromBaseUrl,
  maskApiKey,
  MEMBER_GATEWAY_AUTH_ERROR_REPLY,
  MEMBER_GATEWAY_EMPTY_ERROR_REPLY,
  MEMBER_GATEWAY_TRANSIENT_ERROR_REPLY,
  OPENROUTER_DEFAULT_BASE_URL,
  readLlmGatewayEnv,
  redactSecrets,
  resolveLlmGateway,
  resolveModelId,
  STUB_ASSISTANT_REPLY,
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
    defaultTier: DEFAULT_MODEL_TIER,
    modelOverrides: { cheap: 'store-cheap' },
    providers: [{
      id: 'legacy',
      kind: 'openai-compatible' as const,
      apiKey: 'sk-store',
      baseUrl: 'https://store.example/v1',
      defaultModel: null,
    }],
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

it('defaults Settings to the OpenRouter preset and keeps a custom URL', () => {
  expect(llmGatewayPresetFromBaseUrl(null)).toBe('openrouter')
  expect(llmGatewayPresetFromBaseUrl('')).toBe('openrouter')
  expect(llmGatewayPresetFromBaseUrl(OPENROUTER_DEFAULT_BASE_URL)).toBe('openrouter')
  expect(llmGatewayPresetFromBaseUrl(`${OPENROUTER_DEFAULT_BASE_URL}/`)).toBe('openrouter')
  expect(llmGatewayPresetFromBaseUrl(`${OPENROUTER_DEFAULT_BASE_URL}///`)).toBe('openrouter')
  expect(llmGatewayPresetFromBaseUrl('https://example.test/v1')).toBe('custom')
  expect(baseUrlForLlmGatewayPreset('openrouter')).toBe(OPENROUTER_DEFAULT_BASE_URL)
  expect(baseUrlForLlmGatewayPreset('openrouter', 'https://example.test/v1')).toBe(
    OPENROUTER_DEFAULT_BASE_URL,
  )
  expect(baseUrlForLlmGatewayPreset('custom', 'https://example.test/v1/')).toBe(
    'https://example.test/v1',
  )
  expect(baseUrlForLlmGatewayPreset('custom', '   ')).toBe(null)
})

it('keeps an unconfigured Chat reply calm and product-facing', () => {
  expect(STUB_ASSISTANT_REPLY).toContain('OpenRouter')
  expect(STUB_ASSISTANT_REPLY).toContain('Settings')
  expect(STUB_ASSISTANT_REPLY.toLowerCase()).not.toContain('stub')
  expect(STUB_ASSISTANT_REPLY.toLowerCase()).not.toContain('llm gateway')
})

it('uses distinct Russian gateway errors for the Owner and a Member', () => {
  expect(LLM_GATEWAY_RETRY_BACKOFF_MS).toBeGreaterThanOrEqual(400)
  expect(LLM_GATEWAY_RETRY_BACKOFF_MS).toBeLessThanOrEqual(800)

  expect(llmGatewayErrorReply('owner', 'auth')).toBe(LLM_GATEWAY_AUTH_ERROR_REPLY)
  expect(LLM_GATEWAY_AUTH_ERROR_REPLY).toContain('Settings')
  expect(LLM_GATEWAY_AUTH_ERROR_REPLY).not.toMatch(/ещё раз|напиши|отправ/i)

  expect(llmGatewayErrorReply('owner', 'transient')).toBe(LLM_GATEWAY_TRANSIENT_ERROR_REPLY)
  expect(LLM_GATEWAY_TRANSIENT_ERROR_REPLY).toContain('Отправь сообщение ещё раз')
  expect(LLM_GATEWAY_TRANSIENT_ERROR_REPLY).toContain('Если снова упадёт — проверь ключ в Settings')

  expect(llmGatewayErrorReply('owner', 'empty')).toBe(LLM_GATEWAY_EMPTY_ERROR_REPLY)
  expect(LLM_GATEWAY_EMPTY_ERROR_REPLY).toContain('пустой ответ')
  expect(LLM_GATEWAY_EMPTY_ERROR_REPLY).toContain('Напиши ещё раз')
  expect(LLM_GATEWAY_EMPTY_ERROR_REPLY).not.toContain('Settings')

  expect(llmGatewayErrorReply('member', 'auth')).toBe(MEMBER_GATEWAY_AUTH_ERROR_REPLY)
  expect(MEMBER_GATEWAY_AUTH_ERROR_REPLY).toContain('Владелец')
  expect(MEMBER_GATEWAY_AUTH_ERROR_REPLY).not.toMatch(/отправ|напиши ещё раз/i)
  expect(MEMBER_GATEWAY_AUTH_ERROR_REPLY).not.toBe(LLM_GATEWAY_AUTH_ERROR_REPLY)

  expect(llmGatewayErrorReply('member', 'transient')).toBe(MEMBER_GATEWAY_TRANSIENT_ERROR_REPLY)
  expect(MEMBER_GATEWAY_TRANSIENT_ERROR_REPLY).toContain('ещё раз')
  expect(MEMBER_GATEWAY_TRANSIENT_ERROR_REPLY).not.toContain('Settings')
  expect(MEMBER_GATEWAY_TRANSIENT_ERROR_REPLY).not.toBe(LLM_GATEWAY_TRANSIENT_ERROR_REPLY)

  expect(llmGatewayErrorReply('member', 'empty')).toBe(MEMBER_GATEWAY_EMPTY_ERROR_REPLY)
  expect(MEMBER_GATEWAY_EMPTY_ERROR_REPLY).toContain('пустой ответ')
  expect(MEMBER_GATEWAY_EMPTY_ERROR_REPLY).toContain('ещё раз')
  expect(MEMBER_GATEWAY_EMPTY_ERROR_REPLY).not.toContain('Settings')
})

it('uses Store Provider settings when env is unset, defaulting the base to OpenRouter', () => {
  const resolved = resolveLlmGateway(readLlmGatewayEnv({}), {
    baseUrl: null,
    defaultTier: 'code',
    modelOverrides: {},
    providers: [{
      id: 'legacy',
      kind: 'openrouter',
      apiKey: 'sk-store',
      baseUrl: null,
      defaultModel: null,
    }],
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

  const stored = {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultTier: 'strong' as const,
    modelOverrides: {},
    providers: [{
      id: 'legacy',
      kind: 'openrouter' as const,
      apiKey: key,
      baseUrl: null,
      defaultModel: null,
    }],
  }
  const resolved = resolveLlmGateway(readLlmGatewayEnv({}), stored)
  const pub = toPublicLlmGateway({
    resolved,
    stored,
  })
  expect(pub.hasApiKey).toBe(true)
  expect(pub.hasStoredApiKey).toBe(true)
  expect(pub.apiKeyMasked).toBe('••••wxyz')
  expect(pub.providers).toEqual([{
    id: 'legacy',
    kind: 'openrouter',
    baseUrl: null,
    hasApiKey: true,
    apiKeyMasked: '••••wxyz',
    defaultModel: null,
  }])
  expect(pub.tierBinds).toEqual({})
  expect(JSON.stringify(pub).includes(key)).toBe(false)
  expect(pub).not.toHaveProperty('apiKey')
})

it('stays on the Manifest and drops the learn-your-purpose line', () => {
  const prompt = chatSystemPrompt({
    botName: 'New Bot',
    manifest: {
      name: 'New Bot',
      label: 'notes',
      description: 'Keeps field notes',
      modelTier: 'strong',
      skillIds: ['notes'],
      modulePackageIds: [],
    },
    skills: [{
      id: 'notes',
      description: 'Keep short notes.',
      instructions: 'Write everything down. This body stays off the catalog.',
    }],
  })
  expect(prompt).toContain('Stay on the Manifest. Reply briefly.')
  expect(prompt).toContain('Reply briefly and stay in character.')
  expect(prompt).not.toContain('You are new. Ask and learn what this Bot is for.')
  expect(prompt).toContain('Manifest: name=New Bot; label=notes; description=Keeps field notes; Model tier=strong; Skills=notes; Module packages=none yet.')
  expect(prompt).toContain('Skill notes: Keep short notes.')
  expect(prompt).not.toContain('Write everything down')
  expect(prompt).toContain(CHAT_SELF_SETTINGS_RULE)
  expect(prompt).toContain(CHAT_NO_PACKAGE_RULE)
  expect(prompt).toContain(CHAT_HTTP_GET_HINT)
})

it('falls back to Skill {id} when a catalog description is missing', () => {
  const prompt = chatSystemPrompt({
    botName: 'Notes',
    manifest: {
      name: 'Notes',
      modelTier: 'strong',
      skillIds: ['notes'],
      modulePackageIds: [],
    },
    skills: [{ id: 'notes', description: '', instructions: 'Keep short notes.' }],
  })
  expect(prompt).toContain('Skill notes')
  expect(prompt).not.toContain('Keep short notes.')
})

it('tells a slim Chat Bot it may list and read Skills, not write Bots', () => {
  const prompt = chatSystemPrompt({
    botName: 'Notes',
    botId: 'bot-1',
    tools: true,
    manifest: {
      name: 'Notes',
      modelTier: 'strong',
      skillIds: [],
      modulePackageIds: [],
    },
  })
  expect(prompt).toContain('This Chat is with Bot id=bot-1.')
  expect(prompt).toContain('list and append Chat messages')
  expect(prompt).toContain('dostigus_skills_read')
  expect(prompt).toContain('Do not create, rename, or delete Bots')
  expect(prompt).toContain('You cannot set the Cluster timezone')
  expect(prompt).toContain('You cannot set the Cluster http allowlist')
  expect(prompt).toContain('dostigus_http_get')
  expect(prompt).not.toContain('read and write Bots')
  expect(prompt).not.toContain('You may read or set the Cluster http allowlist')
  expect(prompt).toContain(CHAT_SELF_SETTINGS_RULE)
})

it('opens Owner builder tools only on expand', () => {
  const prompt = chatSystemPrompt({
    botName: 'Notes',
    tools: true,
    expand: true,
    manifest: {
      name: 'Notes',
      modelTier: 'strong',
      skillIds: [],
      modulePackageIds: [],
    },
  })
  expect(prompt).toContain('You may call Cluster MCP surface tools')
  expect(prompt).toContain('This Cluster has one Owner')
  expect(prompt).toContain('You cannot delete Bots from Chat')
  expect(prompt).toContain('you may read or set the Cluster timezone')
  expect(prompt).toContain('You may read or set the Cluster http allowlist')
})

it('lets a creator Member rename this Bot only on expand', () => {
  const slim = chatSystemPrompt({
    botName: 'Notes',
    tools: true,
    creatorManifest: true,
    manifest: {
      name: 'Notes',
      modelTier: 'strong',
      skillIds: ['notes'],
      modulePackageIds: [],
    },
    skills: [{ id: 'notes', description: 'Keep short notes.', instructions: 'Write it down.' }],
  })
  expect(slim).toContain('Do not create, rename, or delete Bots')
  expect(slim).not.toContain('update this Bot\'s name, label, description, and Skills')
  expect(slim).toContain('Skill notes: Keep short notes.')
  expect(slim).not.toContain('Write it down.')

  const prompt = chatSystemPrompt({
    botName: 'Notes',
    tools: true,
    creatorManifest: true,
    expand: true,
    manifest: {
      name: 'Notes',
      modelTier: 'strong',
      skillIds: ['notes'],
      modulePackageIds: [],
    },
    skills: [{ id: 'notes', description: 'Keep short notes.', instructions: 'Write it down.' }],
  })
  expect(prompt).toContain('update this Bot\'s name, label, description, and Skills')
  expect(prompt).not.toContain('Do not create, rename, or delete Bots')
  expect(prompt).toContain('Do not create or delete Bots')
  expect(prompt).toContain('You cannot set the Cluster timezone')
  expect(prompt).toContain('You cannot set the Cluster http allowlist')
  expect(prompt).toContain(CHAT_SELF_SETTINGS_RULE)
  expect(prompt).toContain('Do not claim success without a successful tool result')
})

it('puts the self-settings rule on an Owner turn', () => {
  const prompt = chatSystemPrompt({
    botName: 'Notes',
    tools: true,
    manifest: {
      name: 'Notes',
      modelTier: 'strong',
      skillIds: [],
      modulePackageIds: [],
    },
  })
  expect(prompt).toContain(CHAT_SELF_SETTINGS_RULE)
  expect(prompt).toContain('Self-settings')
  expect(prompt).toContain(CHAT_NO_PACKAGE_RULE)
  expect(prompt).toContain('there is no package yet')
  expect(prompt).toContain('pass intent set')
  expect(prompt).toContain('The Host adds the Chat Card')
  expect(prompt).not.toContain('dostigus_modules_apply')
  expect(prompt).not.toContain('Apply a stock')
})

it('gives a Wake the Skill catalog and a narrower tool story', () => {
  const prompt = chatSystemPrompt({
    botName: 'Notes',
    tools: true,
    wake: true,
    manifest: {
      name: 'Notes',
      modelTier: 'strong',
      skillIds: ['notes'],
      modulePackageIds: [],
    },
    skills: [{ id: 'notes', description: 'Keep short notes.', instructions: 'Write it down.' }],
  })
  expect(prompt).toContain('Skill notes: Keep short notes.')
  expect(prompt).not.toContain('Write it down.')
  expect(prompt).toContain('You cannot create, update, pause, resume, or delete Schedules')
  expect(prompt).toContain('dostigus_skills_read')
  expect(prompt).not.toContain('You may call Cluster MCP surface tools')
})
