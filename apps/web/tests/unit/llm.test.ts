import { CHAT_MCP_TOOL_MAX_ITERATIONS } from '@dostigus/shared'
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

it('returns a quiet reply for a Member when no key is set', async () => {
  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: {},
    audience: 'member',
    fetchImpl: (async () => {
      throw new Error('LLM gateway must not be called without a key')
    }) as typeof fetch,
  })
  expect(result.via).toBe('stub')
  expect(result.content).toContain('until the Owner adds an OpenRouter key')
  expect(result.content.toLowerCase()).not.toContain('stub')
})

it('returns a stub reply when the LLM gateway has no key', async () => {
  const invoked: string[] = []
  const fetchImpl = (async () => {
    throw new Error('LLM gateway must not be called without a key')
  }) as typeof fetch

  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: {},
    fetchImpl,
    invokeTool: async (name) => {
      invoked.push(name)
      return { ok: false, name, content: '{}' }
    },
  })
  expect(result.via).toBe('stub')
  expect(result.content).toBe(stubAssistantReply())
  expect(invoked).toEqual([])
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
    botId: 'b1',
    modelTier: 'strong',
    history: [
      {
        id: 'g1',
        botId: 'b1',
        role: 'assistant',
        content: 'Hello — I\'m Notes later. I don\'t have a purpose yet. What should this Bot be for?',
        createdAt: new Date().toISOString(),
        personId: null,
      },
      {
        id: 'm1',
        botId: 'b1',
        role: 'user',
        content: 'Remember things I type',
        createdAt: new Date().toISOString(),
        personId: null,
      },
    ],
    manifest: {
      name: 'Notes later',
      modelTier: 'strong',
      avatarShape: 'goose',
      avatarColor: '#1F7AE5',
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
  const payload = body as {
    messages: Array<{ content: string }>
    tools: Array<{ function: { name: string } }>
  }
  expect(payload.messages[0]?.content).toContain('You may call Cluster MCP surface tools')
  expect(payload.tools.map((tool) => tool.function.name)).toEqual([
    'dostigus_bots_list',
    'dostigus_bots_get',
    'dostigus_bots_create',
    'dostigus_bots_update',
    'dostigus_messages_list',
    'dostigus_messages_create',
  ])
  expect(payload.tools.map((tool) => tool.function.name)).not.toContain('dostigus_bots_delete')
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
  expect(result.content).toContain('Check the key in Settings')
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

it('feeds tool errors back to the model and stores a final assistant reply', async () => {
  const bodies: unknown[] = []
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    bodies.push(body)
    if (bodies.length === 1) {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: {
                name: 'dostigus_bots_get',
                arguments: JSON.stringify({ id: 'missing' }),
              },
            }],
          },
        }],
      }), { status: 200 })
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'That Bot is not in the Store.' } }],
    }), { status: 200 })
  }) as typeof fetch

  const result = await completeAssistantReply({
    botName: 'New Bot',
    botId: 'b1',
    modelTier: 'strong',
    history: [],
    env: {
      OPENAI_COMPATIBLE_BASE_URL: 'https://example.test/v1',
      LLM_API_KEY: 'sk-test',
    },
    fetchImpl,
    invokeTool: async (name) => ({
      ok: false,
      name,
      content: JSON.stringify({ error: 'Bot not found' }),
    }),
  })

  expect(result).toEqual({
    via: 'llm+tools',
    content: 'That Bot is not in the Store.',
  })
  const followUp = bodies[1] as {
    messages: Array<{ role: string, content?: string }>
  }
  expect(followUp.messages).toEqual(expect.arrayContaining([
    {
      role: 'tool',
      tool_call_id: 'call_1',
      content: JSON.stringify({ error: 'Bot not found' }),
    },
  ]))
})

it('stops the Chat MCP tool loop after the iteration cap', async () => {
  let completions = 0
  const invoked: string[] = []
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    completions += 1
    const body = JSON.parse(String(init?.body)) as { tools?: unknown[] }
    if (body.tools?.length) {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            tool_calls: [{
              id: `call_${completions}`,
              type: 'function',
              function: { name: 'dostigus_bots_list', arguments: '{}' },
            }],
          },
        }],
      }), { status: 200 })
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'I listed the Bots I could.' } }],
    }), { status: 200 })
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
    invokeTool: async (name) => {
      invoked.push(name)
      return { ok: true, name, content: '{"bots":[]}' }
    },
  })

  expect(result.via).toBe('llm+tools')
  expect(result.content).toBe('I listed the Bots I could.')
  expect(invoked).toHaveLength(CHAT_MCP_TOOL_MAX_ITERATIONS)
  expect(invoked.every((name) => name === 'dostigus_bots_list')).toBe(true)
  expect(completions).toBe(CHAT_MCP_TOOL_MAX_ITERATIONS + 1)
})

it('skips unknown tools and does not invoke delete from Chat', async () => {
  const invoked: string[] = []
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ role: string, content?: string }>
    }
    const last = body.messages.at(-1)
    if (last?.role !== 'tool') {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            tool_calls: [{
              id: 'call_del',
              type: 'function',
              function: {
                name: 'dostigus_bots_delete',
                arguments: JSON.stringify({ id: 'b1' }),
              },
            }],
          },
        }],
      }), { status: 200 })
    }
    expect(last.content).toContain('unknown or unavailable tool')
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'I cannot delete Bots from Chat.' } }],
    }), { status: 200 })
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
    invokeTool: async (name) => {
      invoked.push(name)
      return { ok: true, name, content: '{}' }
    },
  })
  expect(result.via).toBe('llm+tools')
  expect(invoked).toEqual([])
})
