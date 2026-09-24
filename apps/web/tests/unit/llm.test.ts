import {
  CHAT_MCP_TOOL_MAX_ITERATIONS,
  LLM_GATEWAY_AUTH_ERROR_REPLY,
  LLM_GATEWAY_EMPTY_ERROR_REPLY,
  LLM_GATEWAY_RETRY_BACKOFF_MS,
  LLM_GATEWAY_TRANSIENT_ERROR_REPLY,
  MEMBER_GATEWAY_AUTH_ERROR_REPLY,
  MEMBER_GATEWAY_EMPTY_ERROR_REPLY,
  MEMBER_GATEWAY_TRANSIENT_ERROR_REPLY,
} from '@dostigus/shared'
import { expect, it, vi } from 'vitest'
import {
  completeAssistantReply,
  gatewayErrorReply,
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

  const phases: string[] = []
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
    onActivity: (phase) => {
      phases.push(phase)
    },
  })
  expect(result.via).toBe('stub')
  expect(result.content).toBe(stubAssistantReply())
  expect(invoked).toEqual([])
  expect(phases).toEqual([])
})

it('calls chat completions with greeting history and the Manifest system prompt', async () => {
  let body: unknown
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    body = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'I can be a notes Bot later.' } }],
    }), { status: 200 })
  }) as typeof fetch

  const phases: string[] = []
  const result = await completeAssistantReply({
    botName: 'Notes later',
    botId: 'b1',
    modelTier: 'strong',
    history: [
      {
        id: 'g1',
        botId: 'b1',
        role: 'assistant',
        content: 'Hello — I\'m Notes later.',
        createdAt: new Date().toISOString(),
        personId: null,
        parts: [],
      },
      {
        id: 'm1',
        botId: 'b1',
        role: 'user',
        content: 'Remember things I type',
        createdAt: new Date().toISOString(),
        personId: null,
        parts: [],
      },
    ],
    manifest: {
      name: 'Notes later',
      modelTier: 'strong',
      avatarShape: 'goose',
      avatarColor: '#1F7AE5',
      label: '',
      description: '',
      skillIds: [],
      modulePackageIds: [],
    },
    env: {
      OPENAI_COMPATIBLE_BASE_URL: 'https://example.test/v1',
      LLM_API_KEY: 'sk-test-secret-key',
    },
    fetchImpl,
    onActivity: (phase) => {
      phases.push(phase)
    },
  })

  expect(result).toEqual({
    via: 'llm',
    content: 'I can be a notes Bot later.',
  })
  expect(phases).toEqual(['thinking', 'typing'])
  expect(body).toMatchObject({
    model: 'openai/gpt-4o',
    messages: [
      {
        role: 'system',
        content: expect.stringContaining('You are new. Ask and learn what this Bot is for.'),
      },
      {
        role: 'assistant',
        content: 'Hello — I\'m Notes later.',
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
  expect(payload.messages[0]?.content).toContain('Do not claim success without a successful tool result')
  expect(payload.messages[0]?.content).toContain('Self-settings')
  expect(payload.tools.map((tool) => tool.function.name)).toEqual([
    'dostigus_bots_list',
    'dostigus_bots_get',
    'dostigus_bots_create',
    'dostigus_bots_update',
    'dostigus_skills_list',
    'dostigus_skills_upsert',
    'dostigus_skills_delete',
    'dostigus_messages_list',
    'dostigus_messages_create',
    'dostigus_schedules_list',
    'dostigus_schedules_create',
    'dostigus_schedules_update',
    'dostigus_schedules_pause',
    'dostigus_schedules_resume',
    'dostigus_schedules_delete',
    'dostigus_cluster_timezone_get',
    'dostigus_cluster_timezone_set',
  ])
  expect(payload.tools.map((tool) => tool.function.name)).not.toContain('dostigus_bots_delete')
  expect(JSON.stringify(body)).not.toContain('sk-test-secret-key')
})

it('sends a system Wake to the model as the line to answer', async () => {
  let body: unknown
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    body = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'Here is the morning note.' } }],
    }), { status: 200 })
  }) as typeof fetch

  await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    history: [
      {
        id: 'wake',
        botId: 'b1',
        role: 'system',
        content: 'Morning briefing',
        createdAt: new Date().toISOString(),
        personId: null,
        parts: [],
      },
    ],
    env: {
      OPENAI_COMPATIBLE_BASE_URL: 'https://example.test/v1',
      LLM_API_KEY: 'sk-test',
    },
    fetchImpl,
  })

  const payload = body as { messages: Array<{ role: string, content: string }> }
  expect(payload.messages.map((message) => message.role)).toEqual(['system', 'user'])
  expect(payload.messages[1]?.content).toBe('Morning briefing')
})

it('loads Skill instructions and creator tools into a Member turn', async () => {
  let body: unknown
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    body = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'Noted.' } }],
    }), { status: 200 })
  }) as typeof fetch

  await completeAssistantReply({
    botName: 'Notes',
    botId: 'b1',
    modelTier: 'strong',
    history: [],
    audience: 'member',
    canEditManifest: true,
    skills: [{ id: 'notes', instructions: 'Keep short notes.' }],
    env: {
      OPENAI_COMPATIBLE_BASE_URL: 'https://example.test/v1',
      LLM_API_KEY: 'sk-test',
    },
    fetchImpl,
  })

  const payload = body as {
    messages: Array<{ content: string }>
    tools: Array<{ function: { name: string } }>
  }
  expect(payload.messages[0]?.content).toContain('Skill notes: Keep short notes.')
  expect(payload.messages[0]?.content).toContain('Do not claim success without a successful tool result')
  expect(payload.messages[0]?.content).not.toContain('Do not create, rename, or delete Bots')
  expect(payload.tools.map((tool) => tool.function.name)).toEqual([
    'dostigus_messages_list',
    'dostigus_messages_create',
    'dostigus_schedules_list',
    'dostigus_schedules_create',
    'dostigus_schedules_update',
    'dostigus_schedules_pause',
    'dostigus_schedules_resume',
    'dostigus_schedules_delete',
    'dostigus_cluster_timezone_get',
    'dostigus_bots_update',
    'dostigus_skills_list',
    'dostigus_skills_upsert',
    'dostigus_skills_delete',
  ])
  expect(payload.tools.map((tool) => tool.function.name)).not.toContain('dostigus_cluster_timezone_set')
})

it('retries a configured HTTP 500 once, then stores the transient reply', async () => {
  let calls = 0
  const fetchImpl = (async () => {
    calls += 1
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

  expect(calls).toBe(2)
  expect(result.via).toBe('error')
  expect(result.content).toBe(LLM_GATEWAY_TRANSIENT_ERROR_REPLY)
  expect(result.content).not.toBe(stubAssistantReply())
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

  const phases: string[] = []
  const tools: Array<{ name: string, ok: boolean, ms: number }> = []
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
    onActivity: (phase) => {
      phases.push(phase)
    },
    onTool: (entry) => {
      tools.push(entry)
    },
  })

  expect(result).toEqual({
    via: 'llm+tools',
    content: 'That Bot is not in the Store.',
  })
  expect(phases).toEqual(['thinking', 'tool', 'thinking', 'typing'])
  expect(tools).toEqual([
    expect.objectContaining({ name: 'dostigus_bots_get', ok: false }),
  ])
  expect(tools[0] && Object.keys(tools[0]).sort()).toEqual(['ms', 'name', 'ok'])
  expect(tools[0]?.ms).toBeGreaterThanOrEqual(0)
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

  const tools: Array<{ name: string, ok: boolean, ms: number }> = []
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
    onTool: (entry) => {
      tools.push(entry)
    },
  })
  expect(result.via).toBe('llm+tools')
  expect(invoked).toEqual([])
  expect(tools).toEqual([{ name: 'dostigus_bots_delete', ok: false, ms: 0 }])
  expect(JSON.stringify(tools)).not.toContain('b1')
})

const GATEWAY_ENV = {
  OPENAI_COMPATIBLE_BASE_URL: 'https://example.test/v1',
  LLM_API_KEY: 'sk-test-secret-key',
}

function completionResponse(content: string | null, status = 200): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }), { status })
}

function namedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

function captureGatewayLogs(): { lines: string[], restore: () => void } {
  const lines: string[] = []
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map((part) => String(part)).join(' '))
  })
  return {
    lines,
    restore() {
      spy.mockRestore()
    },
  }
}

it('defaults an unexpected gateway failure to the transient reply', () => {
  expect(gatewayErrorReply()).toBe(LLM_GATEWAY_TRANSIENT_ERROR_REPLY)
  expect(gatewayErrorReply('member')).toBe(MEMBER_GATEWAY_TRANSIENT_ERROR_REPLY)
})

it('retries HTTP 429 once after a short backoff and stays on thinking', async () => {
  const logs = captureGatewayLogs()
  const times: number[] = []
  const phases: string[] = []
  try {
    const fetchImpl = (async () => {
      times.push(Date.now())
      if (times.length === 1) {
        return new Response('slow down sk-test-secret-key', { status: 429 })
      }
      return completionResponse('Back now.')
    }) as typeof fetch

    const result = await completeAssistantReply({
      botName: 'New Bot',
      modelTier: 'strong',
      history: [],
      env: GATEWAY_ENV,
      fetchImpl,
      onActivity: (phase) => {
        phases.push(phase)
      },
    })

    const gap = (times[1] ?? 0) - (times[0] ?? 0)
    expect(result).toEqual({ via: 'llm', content: 'Back now.' })
    expect(times).toHaveLength(2)
    expect(gap).toBeGreaterThanOrEqual(LLM_GATEWAY_RETRY_BACKOFF_MS - 30)
    expect(phases).toEqual(['thinking', 'typing'])
    const logged = logs.lines.join('\n')
    expect(logged).toContain('LLM gateway request failed (HTTP 429); retrying')
    expect(logged).not.toContain('sk-test-secret-key')
    expect(logged).not.toContain('slow down')
    expect(logged).not.toContain('Authorization')
  } finally {
    logs.restore()
  }
})

it('retries a timeout once and does not show an error phase', async () => {
  const phases: string[] = []
  let calls = 0
  const fetchImpl = (async () => {
    calls += 1
    if (calls === 1) {
      throw namedError('TimeoutError', 'The operation was aborted due to timeout')
    }
    return completionResponse('Recovered.')
  }) as typeof fetch

  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: GATEWAY_ENV,
    fetchImpl,
    onActivity: (phase) => {
      phases.push(phase)
    },
  })

  expect(calls).toBe(2)
  expect(result).toEqual({ via: 'llm', content: 'Recovered.' })
  expect(phases).toEqual(['thinking', 'typing'])
})

it('retries AbortError and a network failure once', async () => {
  const abortCalls = { n: 0 }
  const abortFetch = (async () => {
    abortCalls.n += 1
    if (abortCalls.n === 1) {
      throw namedError('AbortError', 'This operation was aborted')
    }
    return completionResponse('After abort.')
  }) as typeof fetch
  const aborted = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: GATEWAY_ENV,
    fetchImpl: abortFetch,
  })
  expect(abortCalls.n).toBe(2)
  expect(aborted.content).toBe('After abort.')

  const networkCalls = { n: 0 }
  const networkFetch = (async () => {
    networkCalls.n += 1
    if (networkCalls.n === 1) {
      throw new TypeError('fetch failed')
    }
    return completionResponse('After network.')
  }) as typeof fetch
  const networked = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: GATEWAY_ENV,
    fetchImpl: networkFetch,
  })
  expect(networkCalls.n).toBe(2)
  expect(networked.content).toBe('After network.')
})

it('does not retry HTTP 401, 403, or other 4xx', async () => {
  for (const status of [401, 403, 400]) {
    const logs = captureGatewayLogs()
    let calls = 0
    const phases: string[] = []
    try {
      const fetchImpl = (async () => {
        calls += 1
        return new Response(`bad key sk-test-secret-key ${status}`, { status })
      }) as typeof fetch
      const result = await completeAssistantReply({
        botName: 'New Bot',
        modelTier: 'strong',
        history: [],
        env: GATEWAY_ENV,
        fetchImpl,
        onActivity: (phase) => {
          phases.push(phase)
        },
      })
      expect(calls).toBe(1)
      expect(result).toEqual({ via: 'error', content: LLM_GATEWAY_AUTH_ERROR_REPLY })
      expect(phases).toEqual(['thinking'])
      const logged = logs.lines.join('\n')
      expect(logged).toContain(`LLM gateway request failed (HTTP ${status})`)
      expect(logged).not.toContain('retrying')
      expect(logged).not.toContain('sk-test-secret-key')
      expect(logged).not.toContain('bad key')
    } finally {
      logs.restore()
    }
  }
})

it('tells a Member to ask the Owner after an auth failure', async () => {
  let calls = 0
  const fetchImpl = (async () => {
    calls += 1
    return new Response('nope', { status: 401 })
  }) as typeof fetch
  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: GATEWAY_ENV,
    audience: 'member',
    fetchImpl,
  })
  expect(calls).toBe(1)
  expect(result.content).toBe(MEMBER_GATEWAY_AUTH_ERROR_REPLY)
  expect(result.content).not.toBe(LLM_GATEWAY_AUTH_ERROR_REPLY)
})

it('tells a Member they can send again after a transient miss', async () => {
  let calls = 0
  const phases: string[] = []
  const fetchImpl = (async () => {
    calls += 1
    return new Response('down', { status: 503 })
  }) as typeof fetch
  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: GATEWAY_ENV,
    audience: 'member',
    fetchImpl,
    onActivity: (phase) => {
      phases.push(phase)
    },
  })
  expect(calls).toBe(2)
  expect(result).toEqual({ via: 'error', content: MEMBER_GATEWAY_TRANSIENT_ERROR_REPLY })
  expect(phases).toEqual(['thinking'])
  expect(result.content).not.toContain('Settings')
})

it('does not retry an empty assistant body', async () => {
  let calls = 0
  const fetchImpl = (async () => {
    calls += 1
    return completionResponse('   ')
  }) as typeof fetch
  const owner = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: GATEWAY_ENV,
    fetchImpl,
  })
  expect(calls).toBe(1)
  expect(owner).toEqual({ via: 'error', content: LLM_GATEWAY_EMPTY_ERROR_REPLY })

  const memberFetch = (async () => completionResponse('')) as typeof fetch
  const member = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: GATEWAY_ENV,
    audience: 'member',
    fetchImpl: memberFetch,
  })
  expect(member.content).toBe(MEMBER_GATEWAY_EMPTY_ERROR_REPLY)
  expect(member.content).not.toBe(LLM_GATEWAY_EMPTY_ERROR_REPLY)
})

it('retries one completion inside a tool loop without repeating the tool', async () => {
  let calls = 0
  const invoked: string[] = []
  const phases: string[] = []
  const fetchImpl = (async () => {
    calls += 1
    if (calls === 1) {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: { name: 'dostigus_bots_list', arguments: '{}' },
            }],
          },
        }],
      }), { status: 200 })
    }
    if (calls === 2) {
      return new Response('unavailable', { status: 502 })
    }
    return completionResponse('Listed.')
  }) as typeof fetch

  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: GATEWAY_ENV,
    fetchImpl,
    invokeTool: async (name) => {
      invoked.push(name)
      return { ok: true, name, content: '{"bots":[]}' }
    },
    onActivity: (phase) => {
      phases.push(phase)
    },
  })

  expect(result).toEqual({ via: 'llm+tools', content: 'Listed.' })
  expect(invoked).toEqual(['dostigus_bots_list'])
  expect(calls).toBe(3)
  expect(phases).toEqual(['thinking', 'tool', 'thinking', 'typing'])
})
