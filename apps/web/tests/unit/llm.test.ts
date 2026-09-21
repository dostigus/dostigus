import { expect, it } from 'vitest'
import {
  completeAssistantReply,
  isLlmGatewayConfigured,
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
  })
  expect(isLlmGatewayConfigured({
    OPENAI_COMPATIBLE_BASE_URL: 'https://openrouter.ai/api/v1',
    LLM_API_KEY: 'sk-test',
  })).toBe(true)
})

it('returns a stub reply when the LLM gateway is unset', async () => {
  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: {},
  })
  expect(result.via).toBe('stub')
  expect(result.content).toBe(stubAssistantReply())
})

it('calls chat completions when the LLM gateway is configured', async () => {
  const fetchImpl = (async () => {
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'I can be a notes Bot later.' } }],
    }), { status: 200 })
  }) as typeof fetch

  const result = await completeAssistantReply({
    botName: 'Notes later',
    modelTier: 'strong',
    history: [{
      id: 'm1',
      botId: 'b1',
      role: 'user',
      content: 'Remember things I type',
      createdAt: new Date().toISOString(),
    }],
    env: {
      OPENAI_COMPATIBLE_BASE_URL: 'https://example.test/v1',
      LLM_API_KEY: 'sk-test',
    },
    fetchImpl,
  })

  expect(result).toEqual({
    via: 'llm',
    content: 'I can be a notes Bot later.',
  })
})

it('falls back to the stub when the LLM gateway fails', async () => {
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

  expect(result.via).toBe('stub')
})
