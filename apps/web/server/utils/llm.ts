import type {
  LlmGatewayStored,
  Manifest,
  Message,
  ModelTier,
  ResolvedLlmGateway,
} from '@dostigus/shared'
import process from 'node:process'
import {
  chatSystemPrompt,
  isLlmGatewayConfigured as envOrStoreConfigured,
  LLM_GATEWAY_ERROR_REPLY,
  LLM_GATEWAY_PING_TIMEOUT_MS,
  LLM_GATEWAY_TIMEOUT_MS,
  readLlmGatewayEnv,
  redactSecrets,
  resolveLlmGateway,
  STUB_ASSISTANT_REPLY,
} from '@dostigus/shared'

export { readLlmGatewayEnv }

export function isLlmGatewayConfigured(
  env: NodeJS.ProcessEnv = process.env,
  stored?: LlmGatewayStored | null,
): boolean {
  return envOrStoreConfigured(env, stored)
}

export function stubAssistantReply(): string {
  return STUB_ASSISTANT_REPLY
}

export function gatewayErrorReply(): string {
  return LLM_GATEWAY_ERROR_REPLY
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
  modelTier: ModelTier
  history: Message[]
  manifest?: Manifest
  env?: NodeJS.ProcessEnv
  stored?: LlmGatewayStored | null
  fetchImpl?: typeof fetch
}): Promise<{ content: string, via: 'llm' | 'stub' | 'error' }> {
  const resolved = resolveClusterLlmGateway({
    env: input.env,
    stored: input.stored,
  })
  if (!resolved.configured) {
    return { content: stubAssistantReply(), via: 'stub' }
  }

  try {
    const content = await callOpenAiCompatible({
      botName: input.botName,
      modelTier: input.modelTier,
      history: input.history,
      manifest: input.manifest,
      resolved,
      fetchImpl: input.fetchImpl ?? fetch,
    })
    const trimmed = content.trim()
    if (!trimmed) {
      return { content: gatewayErrorReply(), via: 'error' }
    }
    return { content: trimmed, via: 'llm' }
  } catch {
    // Do not log the key, headers, or provider body.
    console.error('LLM gateway request failed')
    return { content: gatewayErrorReply(), via: 'error' }
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
  modelTier: ModelTier
  history: Message[]
  manifest?: Manifest
  resolved: ResolvedLlmGateway
  fetchImpl: typeof fetch
}): Promise<string> {
  const { baseUrl, apiKey } = input.resolved
  if (!baseUrl || !apiKey) {
    throw new Error('LLM gateway is not configured')
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const response = await input.fetchImpl(url, {
    method: 'POST',
    headers: gatewayHeaders(apiKey),
    body: JSON.stringify({
      model: input.resolved.modelIdFor(input.modelTier),
      messages: [
        {
          role: 'system',
          content: chatSystemPrompt({
            botName: input.botName,
            manifest: input.manifest ?? {
              name: input.botName,
              modelTier: input.modelTier,
              skillIds: [],
              modulePackageIds: [],
            },
          }),
        },
        ...input.history
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role,
            content: message.content,
          })),
      ],
    }),
    signal: AbortSignal.timeout(LLM_GATEWAY_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`LLM gateway HTTP ${response.status}`)
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return payload.choices?.[0]?.message?.content ?? ''
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
