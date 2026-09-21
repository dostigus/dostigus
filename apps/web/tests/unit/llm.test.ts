import { expect, it } from 'vitest'
import {
  completeAssistantReply,
  isLlmGatewayConfigured,
  pingLlmGateway,
  readLlmGatewayEnv,
  stubAssistantReply,
} from '../../server/utils/llm'

it('reads the LLM gateway from OpenAI-compatible env', () => {
  expect(isLlmGatewayConfigured({})).toBe(false)
  expect(isLlmGatewayConfigured({
    OPENAI_COMPATIBLE_BASE_URL: 'https://openrouter.ai/api/v1',
  })).toBe(false)
  expect(readLlmGatewayEnv({
    OPENAI_COMPATIBLE_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_API_KEY: 'sk-test',
    LLM_MODEL: 'openai/gpt-4o',
  })).toEqual({
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-test',
    model: 'openai/gpt-4o',
    defaultTier: undefined,
    modelOverrides: undefined,
  })
  expect(isLlmGatewayConfigured({
    OPENAI_COMPATIBLE_BASE_URL: 'https://openrouter.ai/api/v1',
    LLM_API_KEY: 'sk-test',
  })).toBe(true)
})

it('returns a stub reply when the LLM gateway has no key', async () => {
  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: {},
  })
  expect(result.via).toBe('stub')
  expect(result.content).toBe(stubAssistantReply())
})

it('calls chat completions with greeting history and the Manifest system prompt', async () => {
  let body: unknown
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    body = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'I can be a notes Bot later.' } }],
    }), { status: 200 })
  }) as typeof fetch

  const result = await completeAssistantReply({
    botName: 'Notes later',
    modelTier: 'strong',
    history: [
      {
        id: 'g1',
        botId: 'b1',
        role: 'assistant',
        content: 'Hello — I\'m Notes later. I don\'t have a purpose yet. What should this Bot be for?',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'm1',
        botId: 'b1',
        role: 'user',
        content: 'Remember things I type',
        createdAt: new Date().toISOString(),
      },
    ],
    manifest: {
      name: 'Notes later',
      modelTier: 'strong',
      skillIds: [],
      modulePackageIds: [],
    },
    env: {
      OPENAI_COMPATIBLE_BASE_URL: 'https://example.test/v1',
      LLM_API_KEY: 'sk-test-secret-key',
    },
    fetchImpl,
  })

  expect(result).toEqual({
    via: 'llm',
    content: 'I can be a notes Bot later.',
  })
  expect(body).toMatchObject({
    model: 'openai/gpt-4o',
    messages: [
      {
        role: 'system',
        content: expect.stringContaining('You are new. Ask and learn what this Bot is for.'),
      },
      {
        role: 'assistant',
        content: expect.stringContaining('What should this Bot be for?'),
      },
      {
        role: 'user',
        content: 'Remember things I type',
      },
    ],
  })
  expect(JSON.stringify(body)).not.toContain('sk-test-secret-key')
})

it('fails clearly instead of stubbing when the LLM gateway is configured', async () => {
  const fetchImpl = (async () => {
    return new Response('nope', { status: 500 })
  }) as typeof fetch

  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: {
      OPENAI_COMPATIBLE_BASE_URL: 'https://example.test/v1',
      LLM_API_KEY: 'sk-test',
    },
    fetchImpl,
  })

  expect(result.via).toBe('error')
  expect(result.content).not.toBe(stubAssistantReply())
  expect(result.content).toContain('Check the key and base URL in Settings')
})

it('sanitizes ping errors so the key never appears', async () => {
  const key = 'sk-super-secret-value'
  const fetchImpl = (async () => {
    throw new Error(`Bearer ${key} rejected`)
  }) as typeof fetch

  const result = await pingLlmGateway({
    env: {
      OPENAI_COMPATIBLE_BASE_URL: 'https://example.test/v1',
      LLM_API_KEY: key,
    },
    fetchImpl,
  })
  expect(result.ok).toBe(false)
  expect(JSON.stringify(result)).not.toContain(key)
  expect(result.error).toBe('LLM gateway request failed')
})

it('pings without echoing the key', async () => {
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    expect(String(url)).toBe('https://example.test/v1/models')
    expect(JSON.stringify(init?.headers ?? {})).toContain('sk-test')
    return new Response(JSON.stringify({ data: [] }), { status: 200 })
  }) as typeof fetch

  const result = await pingLlmGateway({
    env: {
      OPENAI_COMPATIBLE_BASE_URL: 'https://example.test/v1',
      LLM_API_KEY: 'sk-test',
    },
    fetchImpl,
  })
  expect(result).toEqual({ ok: true })
})

it('uses Store settings when env is unset', async () => {
  const fetchImpl = (async () => {
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'From Store key.' } }],
    }), { status: 200 })
  }) as typeof fetch

  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'cheap',
    history: [],
    env: {},
    stored: {
      baseUrl: 'https://example.test/v1',
      apiKey: 'sk-store',
      defaultTier: 'cheap',
      modelOverrides: { cheap: 'openai/gpt-4o-mini' },
    },
    fetchImpl,
  })
  expect(result).toEqual({ via: 'llm', content: 'From Store key.' })
})
