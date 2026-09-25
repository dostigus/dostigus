import type { Artifact, Message } from '@dostigus/shared'
import {
  CHAT_MCP_TOOL_MAX_ITERATIONS,
  LLM_GATEWAY_AUTH_ERROR_REPLY,
  LLM_GATEWAY_EMPTY_ERROR_REPLY,
  LLM_GATEWAY_RETRY_BACKOFF_MS,
  LLM_GATEWAY_TRANSIENT_ERROR_REPLY,
  MEMBER_GATEWAY_AUTH_ERROR_REPLY,
  MEMBER_GATEWAY_EMPTY_ERROR_REPLY,
  MEMBER_GATEWAY_TRANSIENT_ERROR_REPLY,
  VISION_EMPTY_CONTENT,
  VISION_JPEG_MIME,
  VISION_SOFT_NOTE,
} from '@dostigus/shared'
import { Agent, ProxyAgent } from 'undici'
import { expect, it, vi } from 'vitest'
import {
  completeAssistantReply,
  gatewayErrorReply,
  isLlmGatewayConfigured,
  parseChatCompletionUsage,
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
  const notes: Array<{ modelId: string, modelTier: string, visionParts: boolean }> = []
  const usages: unknown[] = []
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
    onObservability: (note) => {
      notes.push(note)
    },
    onLlmCompletion: (usage) => {
      usages.push(usage)
    },
  })
  expect(result.via).toBe('stub')
  expect(result.content).toBe(stubAssistantReply())
  expect(invoked).toEqual([])
  expect(phases).toEqual([])
  expect(notes).toEqual([{ modelId: 'openai/gpt-4o', modelTier: 'strong', visionParts: false }])
  expect(usages).toEqual([])
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
        content: expect.stringContaining('Stay on the Manifest. Reply briefly.'),
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
  expect(payload.messages[0]?.content).toContain('list and append Chat messages')
  expect(payload.messages[0]?.content).not.toContain('You may call Cluster MCP surface tools')
  expect(payload.messages[0]?.content).toContain('Do not claim success without a successful tool result')
  expect(payload.messages[0]?.content).toContain('Self-settings')
  expect(payload.messages[0]?.content).not.toContain('You are new. Ask and learn what this Bot is for.')
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
    'dostigus_http_get',
    'dostigus_artifacts_put',
    'dostigus_skills_list',
    'dostigus_skills_read',
  ])
  expect(payload.tools.map((tool) => tool.function.name)).not.toContain('dostigus_bots_delete')
  expect(payload.tools.map((tool) => tool.function.name)).not.toContain('dostigus_bots_update')
  expect(payload.tools.map((tool) => tool.function.name)).not.toContain('dostigus_skills_upsert')
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
  expect(payload.messages.map((message) => message.role)).toEqual(['system', 'system'])
  expect(payload.messages[1]?.content).toBe('Morning briefing')
})

it('loads a Skill catalog and slims a creator Member turn until expand', async () => {
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
    skills: [{
      id: 'notes',
      description: 'Keep short notes.',
      instructions: 'Write everything down.',
    }],
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
  expect(payload.messages[0]?.content).not.toContain('Write everything down.')
  expect(payload.messages[0]?.content).toContain('Do not claim success without a successful tool result')
  expect(payload.messages[0]?.content).toContain('Do not create, rename, or delete Bots')
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
    'dostigus_http_get',
    'dostigus_artifacts_put',
    'dostigus_skills_list',
    'dostigus_skills_read',
  ])
  expect(payload.tools.map((tool) => tool.function.name)).not.toContain('dostigus_bots_update')
  expect(payload.tools.map((tool) => tool.function.name)).not.toContain('dostigus_skills_upsert')
  expect(payload.tools.map((tool) => tool.function.name)).not.toContain('dostigus_cluster_timezone_set')
  expect(payload.tools.map((tool) => tool.function.name)).not.toContain('dostigus_cluster_http_allowlist_set')
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
    expand: true,
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
    expand: true,
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

it('starts Chat on strong and a Wake on cheap', async () => {
  const models: string[] = []
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    models.push(JSON.parse(String(init?.body)).model as string)
    return completionResponse('ok')
  }) as typeof fetch
  await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'cheap',
    history: [],
    env: GATEWAY_ENV,
    fetchImpl,
  })
  await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    wake: true,
    history: [],
    env: GATEWAY_ENV,
    fetchImpl,
  })
  expect(models).toEqual(['openai/gpt-4o', 'openai/gpt-4o-mini'])
})

it('escalates silently after an empty body onto the next Model tier', async () => {
  const models: string[] = []
  const notes: Array<{ modelId: string, modelTier: string }> = []
  const usages: unknown[] = []
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { model: string }
    models.push(body.model)
    if (body.model === 'openrouter/free') {
      return completionResponse('   ')
    }
    return new Response(JSON.stringify({
      model: 'served-strong',
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      choices: [{ message: { content: 'Here you go.' } }],
    }), { status: 200 })
  }) as typeof fetch
  const result = await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'cheap',
    wake: true,
    history: [],
    env: {},
    stored: {
      baseUrl: null,
      apiKey: 'sk-or',
      defaultTier: 'strong',
      modelOverrides: {},
      providers: [{
        id: 'or1',
        kind: 'openrouter',
        apiKey: 'sk-or',
        baseUrl: null,
        defaultModel: null,
      }],
      tierBinds: {
        cheap: { providerId: 'or1', policy: { kind: 'free' } },
        strong: { providerId: 'or1', policy: { kind: 'auto' } },
        code: { providerId: 'or1', policy: { kind: 'auto' } },
        toy: { providerId: 'or1', policy: { kind: 'free' } },
      },
    },
    fetchImpl,
    onObservability: (note) => {
      notes.push({ modelId: note.modelId, modelTier: note.modelTier })
    },
    onLlmCompletion: (usage) => {
      usages.push(usage)
    },
  })
  expect(result).toEqual({ via: 'llm', content: 'Here you go.' })
  expect(models).toEqual(['openrouter/free', 'openrouter/auto'])
  expect(notes).toEqual([
    { modelId: 'openrouter/free', modelTier: 'cheap' },
    { modelId: 'openrouter/auto', modelTier: 'strong' },
  ])
  expect(usages).toHaveLength(2)
  expect(result.content).not.toMatch(/escalat|tier|strong/i)
})

it('escalates after HTTP 500 and keeps the same-model retry on that attempt', async () => {
  const models: string[] = []
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { model: string }
    models.push(body.model)
    if (body.model === 'cheap-model') {
      return new Response('down', { status: 500 })
    }
    return completionResponse('Recovered.')
  }) as typeof fetch
  const result = await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'cheap',
    wake: true,
    history: [],
    env: {},
    stored: {
      baseUrl: null,
      apiKey: 'sk-or',
      defaultTier: 'strong',
      modelOverrides: {},
      providers: [
        {
          id: 'a',
          kind: 'openai-compatible',
          apiKey: 'sk-a',
          baseUrl: 'https://example.test/v1',
          defaultModel: 'cheap-model',
        },
        {
          id: 'b',
          kind: 'openai-compatible',
          apiKey: 'sk-b',
          baseUrl: 'https://example.test/v1',
          defaultModel: 'strong-model',
        },
      ],
      tierBinds: {
        cheap: { providerId: 'a', policy: { kind: 'model', modelId: 'cheap-model' } },
        strong: { providerId: 'b', policy: { kind: 'model', modelId: 'strong-model' } },
      },
    },
    fetchImpl,
  })
  expect(result).toEqual({ via: 'llm', content: 'Recovered.' })
  expect(models).toEqual(['cheap-model', 'cheap-model', 'strong-model'])
})

it('escalates a detectable refuse and stays silent in Chat', async () => {
  const models: string[] = []
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { model: string }
    models.push(body.model)
    if (body.model === 'openrouter/free') {
      return new Response(JSON.stringify({
        choices: [{ finish_reason: 'content_filter', message: { content: 'No.' } }],
      }), { status: 200 })
    }
    return completionResponse('Allowed.')
  }) as typeof fetch
  const result = await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    wake: true,
    history: [],
    env: {},
    stored: {
      baseUrl: null,
      apiKey: 'sk-or',
      defaultTier: 'strong',
      modelOverrides: {},
      providers: [{
        id: 'or1',
        kind: 'openrouter',
        apiKey: 'sk-or',
        baseUrl: null,
        defaultModel: null,
      }],
      tierBinds: {
        cheap: { providerId: 'or1', policy: { kind: 'free' } },
        strong: { providerId: 'or1', policy: { kind: 'auto' } },
      },
    },
    fetchImpl,
  })
  expect(result).toEqual({ via: 'llm', content: 'Allowed.' })
  expect(models).toEqual(['openrouter/free', 'openrouter/auto'])
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
              function: { name: 'dostigus_messages_list', arguments: '{"botId":"b1"}' },
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
  expect(invoked).toEqual(['dostigus_messages_list'])
  expect(calls).toBe(3)
  expect(phases).toEqual(['thinking', 'tool', 'thinking', 'typing'])
})

it('expands Owner builder tools on a keyword hit and keeps a miss slim', async () => {
  const bodies: Array<{ tools: Array<{ function: { name: string } }> }> = []
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as typeof bodies[number])
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'Ok.' } }],
    }), { status: 200 })
  }) as typeof fetch

  await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    history: [],
    expand: true,
    env: GATEWAY_ENV,
    fetchImpl,
  })
  await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    history: [],
    env: GATEWAY_ENV,
    fetchImpl,
  })

  expect(bodies[0]?.tools.map((tool) => tool.function.name)).toContain('dostigus_bots_update')
  expect(bodies[0]?.tools.map((tool) => tool.function.name)).toContain('dostigus_skills_upsert')
  expect(bodies[0]?.tools.map((tool) => tool.function.name)).toContain('dostigus_cluster_timezone_set')
  expect(bodies[1]?.tools.map((tool) => tool.function.name)).not.toContain('dostigus_bots_update')
  expect(bodies[1]?.tools.map((tool) => tool.function.name)).toContain('dostigus_skills_read')
})

it('expands a creator Member with update and Skill write only', async () => {
  let body: unknown
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    body = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'Ok.' } }],
    }), { status: 200 })
  }) as typeof fetch

  await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    history: [],
    audience: 'member',
    canEditManifest: true,
    expand: true,
    env: GATEWAY_ENV,
    fetchImpl,
  })
  const names = (body as { tools: Array<{ function: { name: string } }> }).tools.map((tool) => tool.function.name)
  expect(names).toContain('dostigus_bots_update')
  expect(names).toContain('dostigus_skills_upsert')
  expect(names).toContain('dostigus_skills_delete')
  expect(names).not.toContain('dostigus_bots_create')
  expect(names).not.toContain('dostigus_cluster_timezone_set')
  expect(names).not.toContain('dostigus_cluster_http_allowlist_set')
})

it('does not expand a grantee even when the line hits a keyword', async () => {
  let body: unknown
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    body = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'Ok.' } }],
    }), { status: 200 })
  }) as typeof fetch

  await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    history: [],
    audience: 'member',
    canEditManifest: false,
    expand: true,
    env: GATEWAY_ENV,
    fetchImpl,
  })
  const names = (body as { tools: Array<{ function: { name: string } }> }).tools.map((tool) => tool.function.name)
  expect(names).toContain('dostigus_skills_read')
  expect(names).not.toContain('dostigus_bots_update')
  expect(names).not.toContain('dostigus_skills_upsert')
})

it('sends Wake tools plus the Skill catalog and keeps the Wake as system', async () => {
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
    wake: true,
    skills: [{
      id: 'notes',
      description: 'Keep short notes.',
      instructions: 'Write everything down.',
    }],
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
    env: GATEWAY_ENV,
    fetchImpl,
  })

  const payload = body as {
    messages: Array<{ role: string, content: string }>
    tools: Array<{ function: { name: string } }>
  }
  expect(payload.messages.map((message) => message.role)).toEqual(['system', 'system'])
  expect(payload.messages[0]?.content).toContain('Skill notes: Keep short notes.')
  expect(payload.messages[0]?.content).not.toContain('Write everything down.')
  expect(payload.messages[0]?.content).toContain('You cannot create, update, pause, resume, or delete Schedules')
  expect(payload.tools.map((tool) => tool.function.name)).toEqual([
    'dostigus_http_get',
    'dostigus_artifacts_put',
    'dostigus_skills_list',
    'dostigus_skills_read',
    'dostigus_schedules_list',
    'dostigus_messages_list',
    'dostigus_messages_create',
    'dostigus_cluster_timezone_get',
  ])
})

it('uses HTTPS_PROXY for an https gateway and ignores DOSTIGUS_HTTP_PROXY', async () => {
  let dispatcher: unknown
  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: {
      ...GATEWAY_ENV,
      HTTPS_PROXY: 'http://user:s3cret@llm-proxy.example:8080',
      DOSTIGUS_HTTP_PROXY: 'http://bot-proxy.example:8080',
    },
    fetchImpl: (async (_url, init) => {
      dispatcher = (init as { dispatcher?: unknown } | undefined)?.dispatcher
      return completionResponse('Proxied.')
    }) as typeof fetch,
  })
  expect(result).toEqual({ via: 'llm', content: 'Proxied.' })
  expect(dispatcher).toBeInstanceOf(ProxyAgent)
})

it('goes direct when LLM proxy env is unset', async () => {
  let dispatcher: unknown
  await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: {
      ...GATEWAY_ENV,
      DOSTIGUS_HTTP_PROXY: 'http://bot-proxy.example:8080',
    },
    fetchImpl: (async (_url, init) => {
      dispatcher = (init as { dispatcher?: unknown } | undefined)?.dispatcher
      return completionResponse('Direct.')
    }) as typeof fetch,
  })
  expect(dispatcher).toBeInstanceOf(Agent)
  expect(dispatcher).not.toBeInstanceOf(ProxyAgent)
})

it('fails the LLM call on an invalid HTTPS_PROXY and does not fetch', async () => {
  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: {
      ...GATEWAY_ENV,
      HTTPS_PROXY: '::::',
    },
    fetchImpl: (async () => {
      throw new Error('must not fetch when the LLM proxy is invalid')
    }) as typeof fetch,
  })
  expect(result.via).toBe('error')
  expect(result.content).toBe(LLM_GATEWAY_TRANSIENT_ERROR_REPLY)
})

it('windows history to the last 40 Chat lines including the trigger', async () => {
  let body: unknown
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    body = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'Ok.' } }],
    }), { status: 200 })
  }) as typeof fetch

  const history = Array.from({ length: 41 }, (_, index) => ({
    id: `m${index + 1}`,
    botId: 'b1',
    role: index === 0 ? 'system' as const : 'user' as const,
    content: index === 0 ? 'Morning briefing' : `line ${index + 1}`,
    createdAt: new Date().toISOString(),
    personId: null,
    parts: [],
  }))

  await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    history,
    env: GATEWAY_ENV,
    fetchImpl,
  })

  const payload = body as { messages: Array<{ role: string, content: string }> }
  expect(payload.messages).toHaveLength(41)
  expect(payload.messages[0]?.role).toBe('system')
  expect(payload.messages[1]?.role).toBe('user')
  expect(payload.messages[1]?.content).toBe('line 2')
  expect(payload.messages.at(-1)?.content).toBe('line 41')
})

function jpegArtifact(id: string): Artifact {
  return {
    id,
    filename: `${id}.jpg`,
    mime: 'image/jpeg',
    byteSize: 12,
    createdAt: new Date().toISOString(),
  }
}

function chatLine(input: {
  id: string
  role?: Message['role']
  content: string
  artifacts?: Artifact[]
}): Message {
  return {
    id: input.id,
    botId: 'b1',
    role: input.role ?? 'user',
    content: input.content,
    createdAt: new Date().toISOString(),
    personId: null,
    parts: [],
    artifacts: input.artifacts,
  }
}

const TINY_JPEG = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9])

async function encodeTinyJpeg(): Promise<Uint8Array> {
  return TINY_JPEG
}

async function readTinyJpeg(): Promise<Uint8Array> {
  return TINY_JPEG
}

function userContent(message: { content?: unknown }) {
  return message.content
}

it('keeps image parts off an allowlist miss and adds the soft RU note', async () => {
  let body: unknown
  const notes: Array<{ modelId: string, modelTier: string, visionParts: boolean }> = []
  const result = await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    history: [
      chatLine({
        id: 'u1',
        content: 'Look\n\nAttached Artifacts:\n- a1.jpg (image/jpeg, 12 bytes, id a1)',
        artifacts: [jpegArtifact('a1')],
      }),
    ],
    env: {
      ...GATEWAY_ENV,
      LLM_MODEL: 'meta-llama/llama-3.1-70b',
    },
    fetchImpl: (async (_url, init) => {
      body = JSON.parse(String(init?.body))
      return completionResponse('I only see the name.')
    }) as typeof fetch,
    readArtifactBytes: readTinyJpeg,
    encodeVisionJpeg: encodeTinyJpeg,
    onObservability: (note) => {
      notes.push(note)
    },
  })
  expect(result.via).toBe('llm')
  const payload = body as { messages: Array<{ role: string, content: unknown }>, model: string }
  expect(payload.model).toBe('meta-llama/llama-3.1-70b')
  const trigger = payload.messages.at(-1)
  expect(trigger?.role).toBe('user')
  expect(typeof trigger?.content).toBe('string')
  expect(trigger?.content).toContain(VISION_SOFT_NOTE)
  expect(trigger?.content).toContain('a1.jpg')
  expect(JSON.stringify(payload.messages)).not.toContain('image_url')
  expect(JSON.stringify(payload)).not.toContain('data:image')
  expect(notes).toEqual([{
    modelId: 'meta-llama/llama-3.1-70b',
    modelTier: 'strong',
    visionParts: false,
  }])
})

it('sends JPEG image_url parts on the triggering user line only', async () => {
  let body: unknown
  let notedBeforeFetch = false
  const notes: Array<{ modelId: string, modelTier: string, visionParts: boolean }> = []
  await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    history: [
      chatLine({
        id: 'old',
        content: 'Yesterday\n\nAttached Artifacts:\n- old.jpg (image/jpeg, 12 bytes, id old)',
        artifacts: [jpegArtifact('old')],
      }),
      chatLine({
        id: 'now',
        content: 'Attached Artifacts:\n- now.jpg (image/jpeg, 12 bytes, id now)',
        artifacts: [jpegArtifact('now')],
      }),
    ],
    env: GATEWAY_ENV,
    fetchImpl: (async (_url, init) => {
      notedBeforeFetch = notes.length === 1
      body = JSON.parse(String(init?.body))
      return completionResponse('A red square.')
    }) as typeof fetch,
    readArtifactBytes: readTinyJpeg,
    encodeVisionJpeg: encodeTinyJpeg,
    onObservability: (note) => {
      notes.push(note)
    },
  })
  const payload = body as { messages: Array<{ role: string, content: unknown }> }
  expect(payload.messages).toHaveLength(3)
  expect(payload.messages[1]?.role).toBe('user')
  expect(payload.messages[1]?.content).toBe(
    'Yesterday\n\nAttached Artifacts:\n- old.jpg (image/jpeg, 12 bytes, id old)',
  )
  expect(JSON.stringify(payload.messages[1])).not.toContain('image_url')
  const trigger = userContent(payload.messages[2]!)
  expect(Array.isArray(trigger)).toBe(true)
  const parts = trigger as Array<{ type: string, text?: string, image_url?: { url: string, detail: string } }>
  expect(parts[0]).toEqual({
    type: 'text',
    text: `${VISION_EMPTY_CONTENT}\n\nAttached Artifacts:\n- now.jpg (image/jpeg, 12 bytes, id now)`,
  })
  expect(parts[1]?.type).toBe('image_url')
  expect(parts[1]?.image_url?.detail).toBe('auto')
  expect(parts[1]?.image_url?.url.startsWith(`data:${VISION_JPEG_MIME};base64,`)).toBe(true)
  expect(notedBeforeFetch).toBe(true)
  expect(notes).toEqual([{ modelId: 'openai/gpt-4o', modelTier: 'strong', visionParts: true }])
})

it('keeps those image parts on every tool-loop completion round', async () => {
  const bodies: unknown[] = []
  const notes: Array<{ modelId: string, visionParts: boolean }> = []
  const result = await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    history: [
      chatLine({
        id: 'now',
        content: 'Look\n\nAttached Artifacts:\n- now.jpg (image/jpeg, 12 bytes, id now)',
        artifacts: [jpegArtifact('now')],
      }),
    ],
    env: GATEWAY_ENV,
    fetchImpl: (async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      bodies.push(body)
      if (bodies.length === 1) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              tool_calls: [{
                id: 'call_1',
                type: 'function',
                function: { name: 'dostigus_messages_list', arguments: '{}' },
              }],
            },
          }],
        }), { status: 200 })
      }
      return completionResponse('Saw the photo.')
    }) as typeof fetch,
    invokeTool: async (name) => ({
      ok: true,
      name,
      content: '{"messages":[]}',
    }),
    readArtifactBytes: readTinyJpeg,
    encodeVisionJpeg: encodeTinyJpeg,
    onObservability: (note) => {
      notes.push({ modelId: note.modelId, visionParts: note.visionParts })
    },
  })
  expect(result.content).toBe('Saw the photo.')
  expect(bodies).toHaveLength(2)
  expect(notes).toEqual([{ modelId: 'openai/gpt-4o', visionParts: true }])
  for (const body of bodies) {
    const messages = (body as { messages: Array<{ role: string, content: unknown }> }).messages
    const user = messages.find((message) => message.role === 'user')
    expect(Array.isArray(user?.content)).toBe(true)
    expect(JSON.stringify(user?.content)).toContain('image_url')
    expect(JSON.stringify(user?.content)).toContain(`data:${VISION_JPEG_MIME};base64,`)
  }
})

it('retries a modality error once without image parts', async () => {
  const logs = captureGatewayLogs()
  const bodies: unknown[] = []
  try {
    const result = await completeAssistantReply({
      botName: 'Notes',
      modelTier: 'strong',
      history: [
        chatLine({
          id: 'now',
          content: 'Look\n\nAttached Artifacts:\n- now.jpg (image/jpeg, 12 bytes, id now)',
          artifacts: [jpegArtifact('now')],
        }),
      ],
      env: GATEWAY_ENV,
      fetchImpl: (async (_url, init) => {
        const body = JSON.parse(String(init?.body))
        bodies.push(body)
        if (bodies.length === 1) {
          return new Response('This model does not support image input', { status: 400 })
        }
        return completionResponse('Name and size only.')
      }) as typeof fetch,
      readArtifactBytes: readTinyJpeg,
      encodeVisionJpeg: encodeTinyJpeg,
    })
    expect(result).toEqual({ via: 'llm', content: 'Name and size only.' })
    expect(bodies).toHaveLength(2)
    expect(JSON.stringify((bodies[0] as { messages: unknown }).messages)).toContain('image_url')
    const retryUser = (bodies[1] as { messages: Array<{ role: string, content: unknown }> })
      .messages
      .find((message) => message.role === 'user')
    expect(typeof retryUser?.content).toBe('string')
    expect(retryUser?.content).toContain(VISION_SOFT_NOTE)
    expect(JSON.stringify(retryUser)).not.toContain('image_url')
    const logged = logs.lines.join('\n')
    expect(logged).toContain('LLM gateway request failed (modality); retrying')
    expect(logged).not.toContain('sk-test-secret-key')
    expect(logged).not.toContain('data:image')
    expect(logged).not.toContain('does not support image')
  } finally {
    logs.restore()
  }
})

it('does not attach image parts on a Wake', async () => {
  let body: unknown
  const notes: Array<{ visionParts: boolean }> = []
  await completeAssistantReply({
    botName: 'Notes',
    modelTier: 'strong',
    wake: true,
    history: [
      chatLine({
        id: 'wake',
        role: 'system',
        content: 'Morning briefing',
        artifacts: [jpegArtifact('wake')],
      }),
    ],
    env: GATEWAY_ENV,
    fetchImpl: (async (_url, init) => {
      body = JSON.parse(String(init?.body))
      return completionResponse('Morning.')
    }) as typeof fetch,
    readArtifactBytes: readTinyJpeg,
    encodeVisionJpeg: encodeTinyJpeg,
    onObservability: (note) => {
      notes.push({ visionParts: note.visionParts })
    },
  })
  const payload = body as { messages: Array<{ role: string, content: unknown }> }
  expect(payload.messages.at(-1)?.role).toBe('system')
  expect(payload.messages.at(-1)?.content).toBe('Morning briefing')
  expect(JSON.stringify(payload.messages)).not.toContain('image_url')
  expect(notes).toEqual([{ visionParts: false }])
})

it('parses OpenAI-compatible model and usage, including equivalents', () => {
  expect(parseChatCompletionUsage({
    model: 'openai/gpt-4o-2024-08-06',
    usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
    choices: [{ message: { content: 'Hi' } }],
  })).toEqual({
    servedModelId: 'openai/gpt-4o-2024-08-06',
    promptTokens: 12,
    completionTokens: 4,
    totalTokens: 16,
  })
  expect(parseChatCompletionUsage({
    model: '  openrouter/auto  ',
    usage: { input_tokens: 8, output_tokens: 2, totalTokens: 10 },
  })).toEqual({
    servedModelId: 'openrouter/auto',
    promptTokens: 8,
    completionTokens: 2,
    totalTokens: 10,
  })
  expect(parseChatCompletionUsage({
    model: '',
    choices: [{ message: { content: 'Hi' } }],
  })).toEqual({
    servedModelId: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
  })
  expect(parseChatCompletionUsage({
    model: 'x'.repeat(200),
    usage: { prompt_tokens: -1, completion_tokens: 1.5, total_tokens: '9' },
  })).toEqual({
    servedModelId: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
  })
  expect(parseChatCompletionUsage({
    model: 'openai/gpt-4o',
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  })).toEqual({
    servedModelId: 'openai/gpt-4o',
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  })
  expect(parseChatCompletionUsage(null)).toEqual({
    servedModelId: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
  })
})

it('reports usage after each successful completion and skips failed retries', async () => {
  let calls = 0
  const usages: Array<{ servedModelId: string | null, promptTokens: number | null }> = []
  const fetchImpl = (async () => {
    calls += 1
    if (calls === 1) {
      return new Response(JSON.stringify({
        model: 'openai/gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        choices: [{
          message: {
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: { name: 'dostigus_messages_list', arguments: '{}' },
            }],
          },
        }],
      }), { status: 200 })
    }
    if (calls === 2) {
      return new Response('unavailable', { status: 502 })
    }
    return new Response(JSON.stringify({
      model: 'openai/gpt-4o-mini',
      usage: { prompt_tokens: 20, completion_tokens: 6, total_tokens: 26 },
      choices: [{ message: { content: 'Listed.' } }],
    }), { status: 200 })
  }) as typeof fetch

  const result = await completeAssistantReply({
    botName: 'New Bot',
    modelTier: 'strong',
    history: [],
    env: GATEWAY_ENV,
    fetchImpl,
    invokeTool: async (name) => ({
      ok: true,
      name,
      content: '{"messages":[]}',
    }),
    onLlmCompletion: (usage) => {
      usages.push({ servedModelId: usage.servedModelId, promptTokens: usage.promptTokens })
    },
  })

  expect(result).toEqual({ via: 'llm+tools', content: 'Listed.' })
  expect(calls).toBe(3)
  expect(usages).toEqual([
    { servedModelId: 'openai/gpt-4o', promptTokens: 10 },
    { servedModelId: 'openai/gpt-4o-mini', promptTokens: 20 },
  ])
})
