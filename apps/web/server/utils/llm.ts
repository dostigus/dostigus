import type {
  AssistantReplyVia,
  LlmGatewayFailureKind,
  LlmGatewayStored,
  Manifest,
  Message,
  ModelTier,
  ResolvedLlmGateway,
  Skill,
} from '@dostigus/shared'
import type { ChatActivityPhase } from '../../app/utils/chat-activity'
import type { ChatToolInvokeResult } from './mcp-platform-tools'
import type { OpenAiChatFunctionTool, OpenAiChatMessage, OpenAiToolCall } from './openai-tools'
import process from 'node:process'
import {
  CHAT_MCP_TOOL_MAX_ITERATIONS,
  chatSystemPrompt,
  isLlmGatewayConfigured as envOrStoreConfigured,
  LLM_GATEWAY_PING_TIMEOUT_MS,
  LLM_GATEWAY_RETRY_BACKOFF_MS,
  LLM_GATEWAY_TIMEOUT_MS,
  llmGatewayErrorReply,
  MEMBER_QUIET_ASSISTANT_REPLY,
  readLlmGatewayEnv,
  redactSecrets,
  resolveLlmGateway,
  STUB_ASSISTANT_REPLY,
} from '@dostigus/shared'
import { chatMcpToolsAsOpenAi } from './mcp-platform-tools'
import { isChatMcpTool } from './mcp-surface'
import { collectToolCalls, toolResultError } from './openai-tools'

export { readLlmGatewayEnv }

export type ChatToolInvoker = (
  name: string,
  args: unknown,
) => ChatToolInvokeResult | Promise<ChatToolInvokeResult>

export function isLlmGatewayConfigured(
  env: NodeJS.ProcessEnv = process.env,
  stored?: LlmGatewayStored | null,
): boolean {
  return envOrStoreConfigured(env, stored)
}

export function stubAssistantReply(audience: 'owner' | 'member' = 'owner'): string {
  return audience === 'member' ? MEMBER_QUIET_ASSISTANT_REPLY : STUB_ASSISTANT_REPLY
}

export function gatewayErrorReply(
  audience: 'owner' | 'member' = 'owner',
  kind: LlmGatewayFailureKind = 'transient',
): string {
  return llmGatewayErrorReply(audience, kind)
}

export function resolveClusterLlmGateway(input: {
  env?: NodeJS.ProcessEnv
  stored?: LlmGatewayStored | null
} = {}): ResolvedLlmGateway {
  return resolveLlmGateway(
    readLlmGatewayEnv(input.env ?? process.env),
    input.stored,
  )
}

export async function completeAssistantReply(input: {
  botName: string
  botId?: string
  modelTier: ModelTier
  history: Message[]
  manifest?: Manifest
  env?: NodeJS.ProcessEnv
  stored?: LlmGatewayStored | null
  fetchImpl?: typeof fetch
  invokeTool?: ChatToolInvoker
  tools?: OpenAiChatFunctionTool[]
  audience?: 'owner' | 'member'
  /** Creator or Owner of the Bot on this turn. */
  canEditManifest?: boolean
  /** Skill instructions loaded into the system prompt. */
  skills?: Skill[]
  /** Live Activity phase. Quiet (no key) replies do not call this. */
  onActivity?: (phase: ChatActivityPhase) => void
  /** Tool name, ok, and duration only. Arguments and results stay off this hook. */
  onTool?: (entry: { name: string, ok: boolean, ms: number }) => void
}): Promise<{ content: string, via: AssistantReplyVia }> {
  const audience = input.audience === 'member' ? 'member' : 'owner'
  const creatorManifest = audience === 'member' && input.canEditManifest === true
  const resolved = resolveClusterLlmGateway({
    env: input.env,
    stored: input.stored,
  })
  if (!resolved.configured) {
    return { content: stubAssistantReply(audience), via: 'stub' }
  }

  const tools = input.tools ?? chatMcpToolsAsOpenAi(audience, {
    canEditManifest: creatorManifest,
  })
  const invokeTool = input.invokeTool ?? (async (name) => {
    logChatTool(name, 'skip')
    return {
      ok: false,
      name,
      content: toolResultError('unknown or unavailable tool'),
    }
  })

  try {
    const result = await callOpenAiCompatible({
      botName: input.botName,
      botId: input.botId,
      modelTier: input.modelTier,
      history: input.history,
      manifest: input.manifest,
      resolved,
      fetchImpl: input.fetchImpl ?? fetch,
      tools,
      invokeTool,
      messagesOnly: audience === 'member' && !creatorManifest,
      creatorManifest,
      skills: input.skills,
      onActivity: input.onActivity,
      onTool: input.onTool,
    })
    const trimmed = result.content.trim()
    if (!trimmed) {
      return { content: gatewayErrorReply(audience, 'empty'), via: 'error' }
    }
    return {
      content: trimmed,
      via: result.usedTools ? 'llm+tools' : 'llm',
    }
  } catch (error) {
    const kind: LlmGatewayFailureKind = isGatewayRequestError(error) && error.failure === 'auth'
      ? 'auth'
      : 'transient'
    if (!isGatewayRequestError(error)) {
      // Do not log the key, headers, or provider body.
      console.error('LLM gateway request failed')
    }
    return { content: gatewayErrorReply(audience, kind), via: 'error' }
  }
}

export async function pingLlmGateway(input: {
  env?: NodeJS.ProcessEnv
  stored?: LlmGatewayStored | null
  fetchImpl?: typeof fetch
} = {}): Promise<{ ok: boolean, error?: string }> {
  const resolved = resolveClusterLlmGateway({
    env: input.env,
    stored: input.stored,
  })
  if (!resolved.configured || !resolved.baseUrl || !resolved.apiKey) {
    return { ok: false, error: 'LLM gateway is not configured' }
  }

  const fetchImpl = input.fetchImpl ?? fetch
  try {
    const models = await fetchImpl(`${resolved.baseUrl.replace(/\/$/, '')}/models`, {
      method: 'GET',
      headers: gatewayHeaders(resolved.apiKey),
      signal: AbortSignal.timeout(LLM_GATEWAY_PING_TIMEOUT_MS),
    })
    if (models.ok) {
      return { ok: true }
    }
    if (models.status !== 404) {
      return {
        ok: false,
        error: sanitizeGatewayError(`HTTP ${models.status}`, resolved.apiKey),
      }
    }

    const completion = await fetchImpl(`${resolved.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: gatewayHeaders(resolved.apiKey),
      body: JSON.stringify({
        model: resolved.modelIdFor(resolved.defaultTier),
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(LLM_GATEWAY_PING_TIMEOUT_MS),
    })
    if (!completion.ok) {
      return {
        ok: false,
        error: sanitizeGatewayError(`HTTP ${completion.status}`, resolved.apiKey),
      }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: sanitizeGatewayError(
        error instanceof Error ? error.message : 'LLM gateway ping failed',
        resolved.apiKey,
      ),
    }
  }
}

async function callOpenAiCompatible(input: {
  botName: string
  botId?: string
  modelTier: ModelTier
  history: Message[]
  manifest?: Manifest
  resolved: ResolvedLlmGateway
  fetchImpl: typeof fetch
  tools: OpenAiChatFunctionTool[]
  invokeTool: ChatToolInvoker
  messagesOnly?: boolean
  creatorManifest?: boolean
  skills?: Skill[]
  onActivity?: (phase: ChatActivityPhase) => void
  onTool?: (entry: { name: string, ok: boolean, ms: number }) => void
}): Promise<{ content: string, usedTools: boolean }> {
  const messages: OpenAiChatMessage[] = [
    {
      role: 'system',
      content: chatSystemPrompt({
        botName: input.botName,
        botId: input.botId,
        tools: input.tools.length > 0,
        messagesOnly: input.messagesOnly,
        creatorManifest: input.creatorManifest,
        skills: input.skills,
        manifest: input.manifest ?? {
          name: input.botName,
          modelTier: input.modelTier,
          skillIds: [],
          modulePackageIds: [],
        },
      }),
    },
    ...input.history.map((message) => ({
      // A stored system line is a Wake or a Skill / self-settings notice.
      // The Bot sees it as a user line. It does not start a turn by itself.
      role: message.role === 'system' ? 'user' as const : message.role,
      content: message.content,
    })),
  ]

  let usedTools = false

  for (let iteration = 0; iteration < CHAT_MCP_TOOL_MAX_ITERATIONS; iteration += 1) {
    input.onActivity?.('thinking')
    const message = await postChatCompletion({
      resolved: input.resolved,
      modelTier: input.modelTier,
      fetchImpl: input.fetchImpl,
      messages,
      tools: input.tools,
    })
    const toolCalls = collectToolCalls(message)
    if (toolCalls.length === 0) {
      input.onActivity?.('typing')
      return { content: message.content ?? '', usedTools }
    }

    usedTools = true
    messages.push({
      role: 'assistant',
      content: message.content ?? null,
      tool_calls: toolCalls,
    })
    input.onActivity?.('tool')
    await appendToolResults({
      toolCalls,
      messages,
      invokeTool: input.invokeTool,
      onTool: input.onTool,
    })
  }

  input.onActivity?.('typing')
  const finalMessage = await postChatCompletion({
    resolved: input.resolved,
    modelTier: input.modelTier,
    fetchImpl: input.fetchImpl,
    messages,
  })
  return { content: finalMessage.content ?? '', usedTools }
}

async function appendToolResults(input: {
  toolCalls: OpenAiToolCall[]
  messages: OpenAiChatMessage[]
  invokeTool: ChatToolInvoker
  onTool?: (entry: { name: string, ok: boolean, ms: number }) => void
}): Promise<void> {
  for (const call of input.toolCalls) {
    const name = call.function?.name ?? ''
    const toolCallId = call.id
    if (!isChatMcpTool(name)) {
      logChatTool(name || 'unknown', 'skip')
      input.onTool?.({ name, ok: false, ms: 0 })
      input.messages.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: toolResultError('unknown or unavailable tool'),
      })
      continue
    }

    const started = performance.now()
    try {
      const result = await input.invokeTool(name, call.function?.arguments ?? '{}')
      input.onTool?.({ name, ok: result.ok, ms: elapsedMs(started) })
      input.messages.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: result.content,
      })
    } catch {
      logChatTool(name, 'fail')
      input.onTool?.({ name, ok: false, ms: elapsedMs(started) })
      input.messages.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: toolResultError('tool failed'),
      })
    }
  }
}

function elapsedMs(started: number): number {
  return Math.max(0, Math.round(performance.now() - started))
}

/** One automatic retry, and only for a transient failure of this request. */
const LLM_GATEWAY_ATTEMPTS = 2

class LlmGatewayRequestError extends Error {
  constructor(
    readonly failure: 'auth' | 'transient',
    /** Status class or transport label. Never a key, header, or provider body. */
    readonly detail: string,
    readonly status?: number,
  ) {
    super(detail)
    this.name = 'LlmGatewayRequestError'
  }
}

function isGatewayRequestError(error: unknown): error is LlmGatewayRequestError {
  return error instanceof LlmGatewayRequestError
}

async function postChatCompletion(input: {
  resolved: ResolvedLlmGateway
  modelTier: ModelTier
  fetchImpl: typeof fetch
  messages: OpenAiChatMessage[]
  tools?: OpenAiChatFunctionTool[]
}): Promise<{ content?: string | null, tool_calls?: OpenAiToolCall[] }> {
  let last: LlmGatewayRequestError | undefined
  for (let attempt = 1; attempt <= LLM_GATEWAY_ATTEMPTS; attempt += 1) {
    try {
      return await postChatCompletionAttempt(input)
    } catch (error) {
      if (!isGatewayRequestError(error) || error.failure !== 'transient') {
        if (isGatewayRequestError(error)) {
          logGatewayFailure(error.detail, 'stop')
        }
        throw error
      }
      last = error
      const retry = attempt < LLM_GATEWAY_ATTEMPTS
      logGatewayFailure(error.detail, retry ? 'retry' : 'stop')
      if (!retry) {
        throw error
      }
      // Activity stays on thinking: this function does not change the phase.
      if (error.status === 429) {
        await delay(LLM_GATEWAY_RETRY_BACKOFF_MS)
      }
    }
  }
  throw last ?? new LlmGatewayRequestError('transient', 'network')
}

async function postChatCompletionAttempt(input: {
  resolved: ResolvedLlmGateway
  modelTier: ModelTier
  fetchImpl: typeof fetch
  messages: OpenAiChatMessage[]
  tools?: OpenAiChatFunctionTool[]
}): Promise<{ content?: string | null, tool_calls?: OpenAiToolCall[] }> {
  const { baseUrl, apiKey } = input.resolved
  if (!baseUrl || !apiKey) {
    throw new Error('LLM gateway is not configured')
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const body: Record<string, unknown> = {
    model: input.resolved.modelIdFor(input.modelTier),
    messages: input.messages,
  }
  if (input.tools?.length) {
    body.tools = input.tools
  }

  let response: Response
  try {
    response = await input.fetchImpl(url, {
      method: 'POST',
      headers: gatewayHeaders(apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LLM_GATEWAY_TIMEOUT_MS),
    })
  } catch (error) {
    const detail = isTimeoutOrAbort(error) ? 'timeout' : 'network'
    throw new LlmGatewayRequestError('transient', detail)
  }

  if (!response.ok) {
    throw gatewayFailureForStatus(response.status)
  }

  let payload: {
    choices?: Array<{ message?: { content?: string | null, tool_calls?: OpenAiToolCall[] } }>
  }
  try {
    payload = await response.json() as typeof payload
  } catch {
    // A parse error can quote the provider body. Log only the label.
    throw new LlmGatewayRequestError('transient', 'invalid')
  }
  return payload.choices?.[0]?.message ?? {}
}

function gatewayFailureForStatus(status: number): LlmGatewayRequestError {
  const detail = `HTTP ${status}`
  if (status === 429 || (status >= 500 && status <= 599)) {
    return new LlmGatewayRequestError('transient', detail, status)
  }
  return new LlmGatewayRequestError('auth', detail, status)
}

function isTimeoutOrAbort(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  const name = 'name' in error ? String(error.name) : ''
  if (name === 'AbortError' || name === 'TimeoutError') {
    return true
  }
  if (error instanceof Error && /timeout|aborted|AbortError/i.test(error.message)) {
    return true
  }
  if ('cause' in error && error.cause && error.cause !== error) {
    return isTimeoutOrAbort(error.cause)
  }
  return false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function logGatewayFailure(detail: string, outcome: 'retry' | 'stop'): void {
  if (outcome === 'retry') {
    console.error(`LLM gateway request failed (${detail}); retrying`)
    return
  }
  console.error(`LLM gateway request failed (${detail})`)
}

function gatewayHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/dostigus/dostigus',
    'X-Title': 'Dostigus',
  }
}

function sanitizeGatewayError(message: string, apiKey: string | null): string {
  const redacted = redactSecrets(message, [apiKey])
  if (/HTTP \d{3}/.test(redacted)) {
    return redacted.match(/HTTP \d{3}/)?.[0] ?? 'LLM gateway request failed'
  }
  if (/timeout|aborted|AbortError/i.test(redacted)) {
    return 'LLM gateway timed out'
  }
  return 'LLM gateway request failed'
}

function logChatTool(name: string, outcome: 'ok' | 'fail' | 'skip'): void {
  console.warn(`Chat MCP tool ${name} ${outcome}`)
}
