import type { Message, ModelTier } from '@dostigus/shared'
import process from 'node:process'

export const STUB_ASSISTANT_REPLY
  = 'Thanks — I will use that when we configure this Bot later. (LLM gateway is not configured; this is a stub reply.)'

type LlmEnv = {
  baseUrl: string | undefined
  apiKey: string | undefined
  model: string | undefined
}

const TIER_MODELS: Record<ModelTier, string> = {
  cheap: 'gpt-4o-mini',
  strong: 'gpt-4o',
  code: 'gpt-4o',
  toy: 'gpt-4o-mini',
}

export function readLlmGatewayEnv(env: NodeJS.ProcessEnv = process.env): LlmEnv {
  const baseUrl = trimOrUndefined(env.OPENAI_COMPATIBLE_BASE_URL)
  const apiKey = trimOrUndefined(env.LLM_API_KEY) ?? trimOrUndefined(env.OPENROUTER_API_KEY)
  const model = trimOrUndefined(env.LLM_MODEL)
  return { baseUrl, apiKey, model }
}

export function isLlmGatewayConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const { baseUrl, apiKey } = readLlmGatewayEnv(env)
  return Boolean(baseUrl && apiKey)
}

export function stubAssistantReply(): string {
  return STUB_ASSISTANT_REPLY
}

export async function completeAssistantReply(input: {
  botName: string
  modelTier: ModelTier
  history: Message[]
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}): Promise<{ content: string, via: 'llm' | 'stub' }> {
  const env = input.env ?? process.env
  if (!isLlmGatewayConfigured(env)) {
    return { content: stubAssistantReply(), via: 'stub' }
  }

  try {
    const content = await callOpenAiCompatible({
      botName: input.botName,
      modelTier: input.modelTier,
      history: input.history,
      env,
      fetchImpl: input.fetchImpl ?? fetch,
    })
    const trimmed = content.trim()
    if (!trimmed) {
      return { content: stubAssistantReply(), via: 'stub' }
    }
    return { content: trimmed, via: 'llm' }
  } catch {
    return { content: stubAssistantReply(), via: 'stub' }
  }
}

async function callOpenAiCompatible(input: {
  botName: string
  modelTier: ModelTier
  history: Message[]
  env: NodeJS.ProcessEnv
  fetchImpl: typeof fetch
}): Promise<string> {
  const { baseUrl, apiKey, model } = readLlmGatewayEnv(input.env)
  if (!baseUrl || !apiKey) {
    throw new Error('LLM gateway is not configured')
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const response = await input.fetchImpl(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/dostigus/dostigus',
      'X-Title': 'Dostigus',
    },
    body: JSON.stringify({
      model: model ?? TIER_MODELS[input.modelTier],
      messages: [
        {
          role: 'system',
          content: systemPrompt(input.botName),
        },
        ...input.history
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role,
            content: message.content,
          })),
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    throw new Error(`LLM gateway HTTP ${response.status}`)
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return payload.choices?.[0]?.message?.content ?? ''
}

function systemPrompt(botName: string): string {
  return [
    `You are ${botName}, a Bot in a Dostigus Cluster.`,
    'The user is telling you what you are for.',
    'Reply briefly and stay in character.',
    'Do not claim you already have Skills or Module packages.',
    'Configuration happens later. Do not offer to write Module packages — that is the Builder.',
  ].join(' ')
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}
