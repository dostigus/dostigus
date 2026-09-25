import type {
  AssistantReplyVia,
  LlmGatewayFailureKind,
  LlmGatewayStored,
  Manifest,
  Message,
  ModelTier,
  ResolvedLlmAttempt,
  ResolvedLlmGateway,
  Skill,
} from '@dostigus/shared'
import type { ChatActivityPhase } from '../../app/utils/chat-activity'
import type { VisionEncodeFn, VisionReadFn } from './artifact-vision'
import type { ChatToolInvokeResult } from './mcp-platform-tools'
import type { OpenAiChatFunctionTool, OpenAiChatMessage, OpenAiToolCall } from './openai-tools'
import process from 'node:process'
import {
  CHAT_MCP_TOOL_MAX_ITERATIONS,
  chatLlmHistory,
  chatSystemPrompt,
  chatToolSurface,
  isLlmGatewayConfigured as envOrStoreConfigured,
  isModalityErrorText,
  LLM_GATEWAY_PING_TIMEOUT_MS,
  LLM_GATEWAY_RETRY_BACKOFF_MS,
  LLM_GATEWAY_TIMEOUT_MS,
  llmGatewayErrorReply,
  MEMBER_QUIET_ASSISTANT_REPLY,
  planEscalateAttempts,
  readLlmGatewayEnv,
  redactSecrets,
  resolveLlmAttempt,
  resolveLlmGateway,
  startTierForSituation,
  STUB_ASSISTANT_REPLY,
} from '@dostigus/shared'
import { applyTriggeringVision, stripVisionImageParts } from './artifact-vision'
import { chatMcpToolsAsOpenAi } from './mcp-platform-tools'
import { isChatMcpTool } from './mcp-surface'
import { collectToolCalls, toolResultError } from './openai-tools'
import {
  attachOutboundDispatcher,
  createOutboundDispatcher,
  resolveLlmOutboundProxy,
  undiciOutboundFetch,
} from './outbound-fetch'

export { readLlmGatewayEnv }

/** LLM-path fetch (ADR 0033): HTTPS_PROXY / HTTP_PROXY, never the Bot HTTP proxy. */
export function llmOutboundFetch(
  targetUrl: string | null,
  env: NodeJS.ProcessEnv,
  fetchImpl?: typeof fetch,
): typeof fetch {
  const parsed = resolveLlmOutboundProxy(targetUrl ?? '', env)
  if (parsed.kind === 'invalid') {
    throw new Error('LLM proxy URL is invalid')
  }
  return attachOutboundDispatcher(
    fetchImpl ?? undiciOutboundFetch,
    createOutboundDispatcher(parsed.kind === 'proxy' ? parsed.href : null),
  )
}

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

function gatewayForAttempt(
  resolved: ResolvedLlmGateway,
  attempt: ResolvedLlmAttempt,
): ResolvedLlmGateway {
  return {
    ...resolved,
    configured: true,
    baseUrl: attempt.baseUrl,
    apiKey: attempt.apiKey,
    modelIdFor: () => attempt.modelId,
  }
}

function pingAttemptFor(
  providerId: string | undefined,
  env: ReturnType<typeof readLlmGatewayEnv>,
  stored: LlmGatewayStored | null | undefined,
  defaultTier: ModelTier,
): ResolvedLlmAttempt | null {
  const options = { env, stored }
  if (providerId) {
    for (const tier of [defaultTier, 'strong', 'cheap', 'code', 'toy'] as const) {
      const attempt = resolveLlmAttempt(tier, options)
      if (attempt && attempt.providerId === providerId) {
        return attempt
      }
    }
  }
  return resolveLlmAttempt('strong', options)
    ?? resolveLlmAttempt('cheap', options)
    ?? resolveLlmAttempt(defaultTier, options)
    ?? resolveLlmAttempt('code', options)
    ?? resolveLlmAttempt('toy', options)
}

/** Provider completion meta for the Turn journal. Missing usage stays null. */
export type LlmCompletionUsage = {
  servedModelId: string | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

const SERVED_MODEL_ID_MAX = 128

function emptyCompletionUsage(): LlmCompletionUsage {
  return {
    servedModelId: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
  }
}

function readUsageToken(usage: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = usage[key]
    if (value == null) {
      continue
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(value)) {
      return null
    }
    return value
  }
  return null
}

function readServedModelId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > SERVED_MODEL_ID_MAX) {
    return null
  }
  return trimmed
}

/** OpenAI-compatible / OpenRouter `model` and `usage`. Equivalents accepted. */
export function parseChatCompletionUsage(payload: unknown): LlmCompletionUsage {
  if (!payload || typeof payload !== 'object') {
    return emptyCompletionUsage()
  }
  const record = payload as Record<string, unknown>
  const usage = record.usage && typeof record.usage === 'object' && !Array.isArray(record.usage)
    ? record.usage as Record<string, unknown>
    : null
  return {
    servedModelId: readServedModelId(record.model),
    promptTokens: usage
      ? readUsageToken(usage, ['prompt_tokens', 'input_tokens', 'promptTokens'])
      : null,
    completionTokens: usage
      ? readUsageToken(usage, ['completion_tokens', 'output_tokens', 'completionTokens'])
      : null,
    totalTokens: usage
      ? readUsageToken(usage, ['total_tokens', 'totalTokens'])
      : null,
  }
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
  /** Keyword expand on this user line. This turn only. */
  expand?: boolean
  /** Wake turn: narrower tools, same Skill catalog. */
  wake?: boolean
  /** Skill catalog loaded into the system prompt. */
  skills?: Skill[]
  /** Live Activity phase. Quiet (no key) replies do not call this. */
  onActivity?: (phase: ChatActivityPhase) => void
  /** Tool name, ok, and duration only. Arguments and results stay off this hook. */
  onTool?: (entry: { name: string, ok: boolean, ms: number }) => void
  /** Resolved request model id, Bot tier, and whether vision parts went on the request. */
  onObservability?: (note: { modelId: string, modelTier: ModelTier, visionParts: boolean }) => void
  /** After each successful LLM completion. Quiet / stub does not call this. */
  onLlmCompletion?: (usage: LlmCompletionUsage) => void
  /** Artifact volume dir for triggering-line vision. */
  artifactsDir?: string
  /** Test double. Production reads Cluster volume bytes. */
  readArtifactBytes?: VisionReadFn
  /** Test double. Production uses sharp. */
  encodeVisionJpeg?: VisionEncodeFn
}): Promise<{ content: string, via: AssistantReplyVia }> {
  const audience = input.audience === 'member' ? 'member' : 'owner'
  const creatorManifest = audience === 'member' && input.canEditManifest === true
  const env = readLlmGatewayEnv(input.env ?? process.env)
  const resolved = resolveClusterLlmGateway({
    env: input.env,
    stored: input.stored,
  })
  const startTier = startTierForSituation(input.wake ? 'wake' : 'chat')
  const attempts = planEscalateAttempts(startTier, {
    env,
    stored: input.stored,
  })
  const modelId = attempts[0]?.modelId ?? resolved.modelIdFor(startTier)
  if (!resolved.configured) {
    input.onObservability?.({
      modelId,
      modelTier: startTier,
      visionParts: false,
    })
    return { content: stubAssistantReply(audience), via: 'stub' }
  }

  const expand = input.expand === true
  const wake = input.wake === true
  const tools = input.tools ?? chatMcpToolsAsOpenAi(audience, {
    canEditManifest: creatorManifest,
    expand,
    wake,
  })
  const invokeTool = input.invokeTool ?? (async (name) => {
    logChatTool(name, 'skip')
    return {
      ok: false,
      name,
      content: toolResultError('unknown or unavailable tool'),
    }
  })

  if (attempts.length === 0) {
    input.onObservability?.({
      modelId,
      modelTier: startTier,
      visionParts: false,
    })
    return { content: gatewayErrorReply(audience, 'transient'), via: 'error' }
  }

  let lastKind: LlmGatewayFailureKind = 'transient'
  for (const [index, attempt] of attempts.entries()) {
    const last = index === attempts.length - 1
    try {
      const result = await callOpenAiCompatible({
        botName: input.botName,
        botId: input.botId,
        modelTier: attempt.modelTier,
        modelId: attempt.modelId,
        history: input.history,
        manifest: input.manifest,
        resolved: gatewayForAttempt(resolved, attempt),
        fetchImpl: llmOutboundFetch(attempt.baseUrl, input.env ?? process.env, input.fetchImpl),
        tools,
        invokeTool,
        audience,
        messagesOnly: audience === 'member' && !creatorManifest,
        creatorManifest,
        expand,
        wake,
        skills: input.skills,
        onActivity: input.onActivity,
        onTool: input.onTool,
        onObservability: input.onObservability,
        onLlmCompletion: input.onLlmCompletion,
        artifactsDir: input.artifactsDir,
        readArtifactBytes: input.readArtifactBytes,
        encodeVisionJpeg: input.encodeVisionJpeg,
      })
      const trimmed = result.content.trim()
      if (result.fail === null && trimmed) {
        return {
          content: trimmed,
          via: result.usedTools ? 'llm+tools' : 'llm',
        }
      }
      lastKind = 'empty'
      if (last) {
        return { content: gatewayErrorReply(audience, 'empty'), via: 'error' }
      }
    } catch (error) {
      lastKind = isGatewayRequestError(error) && error.failure === 'auth'
        ? 'auth'
        : 'transient'
      if (!isGatewayRequestError(error)) {
        // Do not log the key, headers, or provider body.
        console.error('LLM gateway request failed')
      }
      if (last) {
        return { content: gatewayErrorReply(audience, lastKind), via: 'error' }
      }
    }
  }
  return { content: gatewayErrorReply(audience, lastKind), via: 'error' }
}

export async function pingLlmGateway(input: {
  env?: NodeJS.ProcessEnv
  stored?: LlmGatewayStored | null
  fetchImpl?: typeof fetch
  providerId?: string
} = {}): Promise<{ ok: boolean, error?: string }> {
  const env = readLlmGatewayEnv(input.env ?? process.env)
  const resolved = resolveClusterLlmGateway({
    env: input.env,
    stored: input.stored,
  })
  const attempt = pingAttemptFor(input.providerId, env, input.stored, resolved.defaultTier)
  const baseUrl = attempt?.baseUrl ?? resolved.baseUrl
  const apiKey = attempt?.apiKey ?? resolved.apiKey
  const pingModel = attempt?.modelId ?? resolved.modelIdFor(resolved.defaultTier)
  if (!resolved.configured || !baseUrl || !apiKey) {
    return { ok: false, error: 'LLM gateway is not configured' }
  }

  try {
    const fetchImpl = llmOutboundFetch(
      baseUrl,
      input.env ?? process.env,
      input.fetchImpl,
    )
    const models = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/models`, {
      method: 'GET',
      headers: gatewayHeaders(apiKey),
      signal: AbortSignal.timeout(LLM_GATEWAY_PING_TIMEOUT_MS),
    })
    if (models.ok) {
      return { ok: true }
    }
    if (models.status !== 404) {
      return {
        ok: false,
        error: sanitizeGatewayError(`HTTP ${models.status}`, apiKey),
      }
    }

    const completion = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: gatewayHeaders(apiKey),
      body: JSON.stringify({
        model: pingModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(LLM_GATEWAY_PING_TIMEOUT_MS),
    })
    if (!completion.ok) {
      return {
        ok: false,
        error: sanitizeGatewayError(`HTTP ${completion.status}`, apiKey),
      }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: sanitizeGatewayError(
        error instanceof Error ? error.message : 'LLM gateway ping failed',
        apiKey,
      ),
    }
  }
}

async function callOpenAiCompatible(input: {
  botName: string
  botId?: string
  modelTier: ModelTier
  modelId: string
  history: Message[]
  manifest?: Manifest
  resolved: ResolvedLlmGateway
  fetchImpl: typeof fetch
  tools: OpenAiChatFunctionTool[]
  invokeTool: ChatToolInvoker
  audience?: 'owner' | 'member'
  messagesOnly?: boolean
  creatorManifest?: boolean
  expand?: boolean
  wake?: boolean
  skills?: Skill[]
  onActivity?: (phase: ChatActivityPhase) => void
  onTool?: (entry: { name: string, ok: boolean, ms: number }) => void
  onObservability?: (note: { modelId: string, modelTier: ModelTier, visionParts: boolean }) => void
  onLlmCompletion?: (usage: LlmCompletionUsage) => void
  artifactsDir?: string
  readArtifactBytes?: VisionReadFn
  encodeVisionJpeg?: VisionEncodeFn
}): Promise<{ content: string, usedTools: boolean, fail: null | 'empty' | 'refuse' | 'tool_loop' }> {
  const messages: OpenAiChatMessage[] = [
    {
      role: 'system',
      content: chatSystemPrompt({
        botName: input.botName,
        botId: input.botId,
        tools: input.tools.length > 0,
        messagesOnly: input.messagesOnly,
        creatorManifest: input.creatorManifest,
        expand: input.expand,
        wake: input.wake,
        surface: chatToolSurface({
          audience: input.audience,
          canEditManifest: input.creatorManifest,
          expand: input.expand,
          wake: input.wake,
        }),
        skills: input.skills,
        manifest: input.manifest ?? {
          name: input.botName,
          label: '',
          description: '',
          modelTier: input.modelTier,
          skillIds: [],
          modulePackageIds: [],
        },
      }),
    },
    ...chatLlmHistory(input.history, input.history.at(-1)).map(toOpenAiHistoryMessage),
  ]
  const visionParts = await applyTriggeringVision({
    messages,
    trigger: input.history.at(-1),
    modelId: input.modelId,
    wake: input.wake,
    artifactsDir: input.artifactsDir,
    readArtifactBytes: input.readArtifactBytes,
    encodeVisionJpeg: input.encodeVisionJpeg,
  })
  input.onObservability?.({
    modelId: input.modelId,
    modelTier: input.modelTier,
    visionParts,
  })

  let usedTools = false

  for (let iteration = 0; iteration < CHAT_MCP_TOOL_MAX_ITERATIONS; iteration += 1) {
    input.onActivity?.('thinking')
    const message = await postChatCompletion({
      resolved: input.resolved,
      modelId: input.modelId,
      fetchImpl: input.fetchImpl,
      messages,
      tools: input.tools,
      onLlmCompletion: input.onLlmCompletion,
    })
    const toolCalls = collectToolCalls(message)
    if (toolCalls.length === 0) {
      input.onActivity?.('typing')
      if (isExplicitRefuse(message)) {
        return { content: message.content ?? '', usedTools, fail: 'refuse' }
      }
      const content = message.content ?? ''
      return {
        content,
        usedTools,
        fail: content.trim() ? null : 'empty',
      }
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
      allowedTools: input.tools.map((tool) => tool.function.name),
      onTool: input.onTool,
    })
  }

  input.onActivity?.('typing')
  const finalMessage = await postChatCompletion({
    resolved: input.resolved,
    modelId: input.modelId,
    fetchImpl: input.fetchImpl,
    messages,
    onLlmCompletion: input.onLlmCompletion,
  })
  if (isExplicitRefuse(finalMessage)) {
    return { content: finalMessage.content ?? '', usedTools, fail: 'refuse' }
  }
  const content = finalMessage.content ?? ''
  return {
    content,
    usedTools,
    fail: content.trim() ? null : 'tool_loop',
  }
}

async function appendToolResults(input: {
  toolCalls: OpenAiToolCall[]
  messages: OpenAiChatMessage[]
  invokeTool: ChatToolInvoker
  allowedTools: readonly string[]
  onTool?: (entry: { name: string, ok: boolean, ms: number }) => void
}): Promise<void> {
  for (const call of input.toolCalls) {
    const name = call.function?.name ?? ''
    const toolCallId = call.id
    if (!isChatMcpTool(name) || !input.allowedTools.includes(name)) {
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
    readonly failure: 'auth' | 'transient' | 'modality',
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
  modelId: string
  fetchImpl: typeof fetch
  messages: OpenAiChatMessage[]
  tools?: OpenAiChatFunctionTool[]
  onLlmCompletion?: (usage: LlmCompletionUsage) => void
}): Promise<{
  content?: string | null
  tool_calls?: OpenAiToolCall[]
  finish_reason?: string | null
  refusal?: string | null
}> {
  try {
    return await postChatCompletionTransient(input)
  } catch (error) {
    if (!isGatewayRequestError(error) || error.failure !== 'modality') {
      throw error
    }
    if (!stripVisionImageParts(input.messages)) {
      throw new LlmGatewayRequestError('auth', error.detail, error.status)
    }
    logGatewayFailure('modality', 'retry')
    return await postChatCompletionTransient(input)
  }
}

async function postChatCompletionTransient(input: {
  resolved: ResolvedLlmGateway
  modelId: string
  fetchImpl: typeof fetch
  messages: OpenAiChatMessage[]
  tools?: OpenAiChatFunctionTool[]
  onLlmCompletion?: (usage: LlmCompletionUsage) => void
}): Promise<{
  content?: string | null
  tool_calls?: OpenAiToolCall[]
  finish_reason?: string | null
  refusal?: string | null
}> {
  let last: LlmGatewayRequestError | undefined
  for (let attempt = 1; attempt <= LLM_GATEWAY_ATTEMPTS; attempt += 1) {
    try {
      return await postChatCompletionAttempt(input)
    } catch (error) {
      if (!isGatewayRequestError(error) || error.failure !== 'transient') {
        if (isGatewayRequestError(error) && error.failure !== 'modality') {
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
  modelId: string
  fetchImpl: typeof fetch
  messages: OpenAiChatMessage[]
  tools?: OpenAiChatFunctionTool[]
  onLlmCompletion?: (usage: LlmCompletionUsage) => void
}): Promise<{
  content?: string | null
  tool_calls?: OpenAiToolCall[]
  finish_reason?: string | null
  refusal?: string | null
}> {
  const { baseUrl, apiKey } = input.resolved
  if (!baseUrl || !apiKey) {
    throw new Error('LLM gateway is not configured')
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const body: Record<string, unknown> = {
    model: input.modelId,
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
    throw await gatewayFailureForResponse(response)
  }

  let payload: {
    model?: unknown
    usage?: unknown
    choices?: Array<{
      finish_reason?: string | null
      message?: {
        content?: string | null
        tool_calls?: OpenAiToolCall[]
        refusal?: string | null
      }
    }>
  }
  try {
    payload = await response.json() as typeof payload
  } catch {
    // A parse error can quote the provider body. Log only the label.
    throw new LlmGatewayRequestError('transient', 'invalid')
  }
  input.onLlmCompletion?.(parseChatCompletionUsage(payload))
  const choice = payload.choices?.[0]
  return {
    ...(choice?.message ?? {}),
    finish_reason: choice?.finish_reason ?? null,
    refusal: choice?.message?.refusal ?? null,
  }
}

function isExplicitRefuse(message: {
  finish_reason?: string | null
  refusal?: string | null
  tool_calls?: OpenAiToolCall[]
}): boolean {
  if (message.tool_calls && message.tool_calls.length > 0) {
    return false
  }
  if (message.finish_reason === 'content_filter') {
    return true
  }
  return Boolean(message.refusal?.trim())
}

async function gatewayFailureForResponse(response: Response): Promise<LlmGatewayRequestError> {
  const status = response.status
  const detail = `HTTP ${status}`
  if (status === 429 || (status >= 500 && status <= 599)) {
    return new LlmGatewayRequestError('transient', detail, status)
  }
  if (status !== 401 && status !== 403 && status >= 400 && status <= 499) {
    try {
      const text = await response.text()
      if (isModalityErrorText(text)) {
        return new LlmGatewayRequestError('modality', 'modality', status)
      }
    } catch {
      // Do not log the provider body.
    }
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

export function gatewayHeaders(apiKey: string): Record<string, string> {
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

function toOpenAiHistoryMessage(
  message: { role: 'user' | 'assistant' | 'system', content: string },
): OpenAiChatMessage {
  if (message.role === 'user') {
    return { role: 'user', content: message.content }
  }
  return { role: message.role, content: message.content }
}
