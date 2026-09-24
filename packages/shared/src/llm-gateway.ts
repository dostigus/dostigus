/** LLM gateway: Model tier mapping, env/Store resolve, key masking. */

import type { ModelTier, Skill } from './types'
import { DEFAULT_MODEL_TIER, isModelTier, MODEL_TIERS } from './types'

/**
 * Always-on Host instruction. Not a Manifest field and not a Skill.
 * See ADR 0028.
 */
export const CHAT_SELF_SETTINGS_RULE
  = 'Self-settings (name, label, description, Skills, and Schedules when those tools are available) must use the MCP surface. Do not claim success without a successful tool result. On failure, report the error. Appearance and Model tier are not Chat self-settings.'

/**
 * Host instruction beside self-settings. Not a Manifest field and not a Skill.
 * There is no stock Module catalog to Apply. A Schedule change still gets a
 * Chat Card from the Host. See ADR 0030, narrowed 2026-09-24.
 */
export const CHAT_NO_PACKAGE_RULE
  = 'This Host has no stock Module catalog to Apply. If a capability is missing, say briefly that there is no package yet. Do not author a Module package. A Schedule change uses the Schedule tools. When the person asked to set a Schedule and you list first, pass intent set plus cadence, timeLocal, and daysOfWeek. A paused row with that clock is not already standing; resume it. The Host adds the Chat Card, so do not end that turn by only saying the Schedule changed.'

/** OpenRouter-shaped default. Used when a key is set and no base URL is stored or in env. */
export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1' as const

/**
 * OpenRouter-friendly default model ids per Model tier.
 * Override with `LLM_MODEL`, `LLM_MODEL_*`, or Cluster Settings.
 */
export const DEFAULT_TIER_MODELS: Record<ModelTier, string> = {
  cheap: 'openai/gpt-4o-mini',
  strong: 'openai/gpt-4o',
  code: 'openai/gpt-4o',
  toy: 'openai/gpt-4o-mini',
}

export const STUB_ASSISTANT_REPLY
  = 'Got it. Add an OpenRouter key in Settings when you want live replies.'

export const MEMBER_QUIET_ASSISTANT_REPLY
  = 'Got it. Replies stay quiet until the Owner adds an OpenRouter key.'

/**
 * Owner bubble when the gateway rejects the key (HTTP 401 / 403) or
 * another non-retry 4xx. Do not tell them to send the line again.
 */
export const LLM_GATEWAY_AUTH_ERROR_REPLY
  = 'Не получилось ответить. Проверь ключ в Settings.'

/**
 * Owner bubble after one retry still cannot reach the model
 * (timeout, abort, network, HTTP 429, HTTP 5xx).
 */
export const LLM_GATEWAY_TRANSIENT_ERROR_REPLY
  = 'Не получилось связаться с моделью. Отправь сообщение ещё раз. Если снова упадёт — проверь ключ в Settings.'

/** Owner bubble when HTTP succeeded and the assistant text is empty. */
export const LLM_GATEWAY_EMPTY_ERROR_REPLY
  = 'Модель вернула пустой ответ. Напиши ещё раз.'

/** Member cannot open Settings. Point at the Owner for a key problem. */
export const MEMBER_GATEWAY_AUTH_ERROR_REPLY
  = 'Не получилось ответить. Владелец может проверить ключ в Settings.'

/** Member can send the line again. Do not send them to Settings. */
export const MEMBER_GATEWAY_TRANSIENT_ERROR_REPLY
  = 'Не получилось связаться с моделью. Можно отправить сообщение ещё раз.'

export const MEMBER_GATEWAY_EMPTY_ERROR_REPLY
  = 'Модель вернула пустой ответ. Можно написать ещё раз.'

export const LLM_GATEWAY_FAILURE_KINDS = ['auth', 'transient', 'empty'] as const

export type LlmGatewayFailureKind = typeof LLM_GATEWAY_FAILURE_KINDS[number]

const OWNER_GATEWAY_ERROR_REPLIES: Record<LlmGatewayFailureKind, string> = {
  auth: LLM_GATEWAY_AUTH_ERROR_REPLY,
  transient: LLM_GATEWAY_TRANSIENT_ERROR_REPLY,
  empty: LLM_GATEWAY_EMPTY_ERROR_REPLY,
}

const MEMBER_GATEWAY_ERROR_REPLIES: Record<LlmGatewayFailureKind, string> = {
  auth: MEMBER_GATEWAY_AUTH_ERROR_REPLY,
  transient: MEMBER_GATEWAY_TRANSIENT_ERROR_REPLY,
  empty: MEMBER_GATEWAY_EMPTY_ERROR_REPLY,
}

export function llmGatewayErrorReply(
  audience: 'owner' | 'member',
  kind: LlmGatewayFailureKind,
): string {
  const replies = audience === 'member'
    ? MEMBER_GATEWAY_ERROR_REPLIES
    : OWNER_GATEWAY_ERROR_REPLIES
  return replies[kind]
}

export const LLM_GATEWAY_PRESETS = ['openrouter', 'custom'] as const

export type LlmGatewayPreset = typeof LLM_GATEWAY_PRESETS[number]

export const LLM_GATEWAY_TIMEOUT_MS = 30_000
export const LLM_GATEWAY_PING_TIMEOUT_MS = 10_000

/** Pause before the single retry of an HTTP 429. Other transient retries are immediate. */
export const LLM_GATEWAY_RETRY_BACKOFF_MS = 600

/** Chat completions that may call Cluster MCP tools. Includes a final text-only attempt. */
export const CHAT_MCP_TOOL_MAX_ITERATIONS = 6

export const ASSISTANT_REPLY_VIAS = ['llm', 'llm+tools', 'stub', 'error'] as const

export type AssistantReplyVia = typeof ASSISTANT_REPLY_VIAS[number]

const TIER_MODEL_ENV: Record<ModelTier, string> = {
  cheap: 'LLM_MODEL_CHEAP',
  strong: 'LLM_MODEL_STRONG',
  code: 'LLM_MODEL_CODE',
  toy: 'LLM_MODEL_TOY',
}

export type LlmGatewayEnv = {
  baseUrl?: string
  apiKey?: string
  model?: string
  defaultTier?: ModelTier
  modelOverrides?: Partial<Record<ModelTier, string>>
}

export type LlmGatewayStored = {
  baseUrl: string | null
  apiKey: string | null
  defaultTier: ModelTier
  modelOverrides: Partial<Record<ModelTier, string>>
}

export type LlmGatewaySource = 'env' | 'store' | 'merged' | 'none'

export type ResolvedLlmGateway = {
  configured: boolean
  baseUrl: string | null
  apiKey: string | null
  defaultTier: ModelTier
  modelIdFor: (tier: ModelTier) => string
  source: LlmGatewaySource
  envOverride: boolean
}

/** Client-safe LLM gateway status. Never includes the full key. */
export type LlmGatewayPublic = {
  configured: boolean
  baseUrl: string | null
  effectiveBaseUrl: string | null
  hasApiKey: boolean
  hasStoredApiKey: boolean
  apiKeyMasked: string | null
  defaultTier: ModelTier
  modelOverrides: Partial<Record<ModelTier, string>>
  defaultModels: Record<ModelTier, string>
  envOverride: boolean
  source: LlmGatewaySource
}

export function trimOrUndefined(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export function readLlmGatewayEnv(
  env: Record<string, string | undefined> = {},
): LlmGatewayEnv {
  const modelOverrides: Partial<Record<ModelTier, string>> = {}
  for (const tier of MODEL_TIERS) {
    const value = trimOrUndefined(env[TIER_MODEL_ENV[tier]])
    if (value) {
      modelOverrides[tier] = value
    }
  }

  const defaultTierRaw = trimOrUndefined(env.LLM_DEFAULT_TIER)

  return {
    baseUrl: trimOrUndefined(env.OPENAI_COMPATIBLE_BASE_URL),
    apiKey: trimOrUndefined(env.LLM_API_KEY) ?? trimOrUndefined(env.OPENROUTER_API_KEY),
    model: trimOrUndefined(env.LLM_MODEL),
    defaultTier: defaultTierRaw && isModelTier(defaultTierRaw) ? defaultTierRaw : undefined,
    modelOverrides: Object.keys(modelOverrides).length > 0 ? modelOverrides : undefined,
  }
}

export function resolveModelId(
  tier: ModelTier,
  options: {
    env?: LlmGatewayEnv
    stored?: LlmGatewayStored | null
  } = {},
): string {
  return options.env?.model
    ?? options.env?.modelOverrides?.[tier]
    ?? options.stored?.modelOverrides?.[tier]
    ?? DEFAULT_TIER_MODELS[tier]
}

export function resolveLlmGateway(
  env: LlmGatewayEnv,
  stored?: LlmGatewayStored | null,
): ResolvedLlmGateway {
  const storedBase = trimOrUndefined(stored?.baseUrl ?? undefined) ?? null
  const storedKey = trimOrUndefined(stored?.apiKey ?? undefined) ?? null
  const envBase = env.baseUrl ?? null
  const envKey = env.apiKey ?? null

  const apiKey = envKey ?? storedKey
  const explicitBase = envBase ?? storedBase
  const baseUrl = explicitBase ?? (apiKey ? OPENROUTER_DEFAULT_BASE_URL : null)
  const defaultTier = env.defaultTier ?? stored?.defaultTier ?? DEFAULT_MODEL_TIER
  const configured = Boolean(baseUrl && apiKey)

  const envHasCreds = Boolean(envBase || envKey)
  const storeHasCreds = Boolean(storedBase || storedKey)
  let source: LlmGatewaySource = 'none'
  if (envHasCreds && storeHasCreds) {
    source = 'merged'
  } else if (envHasCreds) {
    source = 'env'
  } else if (storeHasCreds) {
    source = 'store'
  }

  return {
    configured,
    baseUrl,
    apiKey,
    defaultTier,
    modelIdFor: (tier) => resolveModelId(tier, { env, stored }),
    source,
    envOverride: envHasCreds,
  }
}

export function isLlmGatewayConfigured(
  env: Record<string, string | undefined> = {},
  stored?: LlmGatewayStored | null,
): boolean {
  return resolveLlmGateway(readLlmGatewayEnv(env), stored).configured
}

/** Last four characters only. Never returns the full key. */
export function maskApiKey(apiKey: string | null | undefined): string | null {
  const trimmed = apiKey?.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length <= 4) {
    return '••••'
  }
  return `••••${trimmed.slice(-4)}`
}

export function redactSecrets(
  text: string,
  secrets: Array<string | null | undefined>,
): string {
  let out = text
  for (const secret of secrets) {
    if (secret && secret.length > 0) {
      out = out.split(secret).join('[redacted]')
    }
  }
  return out
}

export function toPublicLlmGateway(input: {
  resolved: ResolvedLlmGateway
  stored?: LlmGatewayStored | null
}): LlmGatewayPublic {
  const { resolved, stored } = input
  return {
    configured: resolved.configured,
    baseUrl: stored?.baseUrl ?? null,
    effectiveBaseUrl: resolved.baseUrl,
    hasApiKey: Boolean(resolved.apiKey),
    hasStoredApiKey: Boolean(trimOrUndefined(stored?.apiKey)),
    apiKeyMasked: maskApiKey(resolved.apiKey),
    defaultTier: stored?.defaultTier ?? resolved.defaultTier,
    modelOverrides: stored?.modelOverrides ?? {},
    defaultModels: { ...DEFAULT_TIER_MODELS },
    envOverride: resolved.envOverride,
    source: resolved.source,
  }
}

export function chatSystemPrompt(input: {
  botName: string
  manifest: {
    name: string
    modelTier: ModelTier
    skillIds: string[]
    modulePackageIds: string[]
  }
  botId?: string
  tools?: boolean
  /** Grantee Chat: messages, Schedules, and timezone read. Not Manifest or Skills. */
  messagesOnly?: boolean
  /** Member who created this Bot may edit its Manifest and Skills. */
  creatorManifest?: boolean
  /** Skill text for this Bot. Ids with empty instructions are omitted. */
  skills?: Skill[]
}): string {
  const skills = input.manifest.skillIds.length > 0
    ? input.manifest.skillIds.join(', ')
    : 'none yet'
  const modules = input.manifest.modulePackageIds.length > 0
    ? input.manifest.modulePackageIds.join(', ')
    : 'none yet'
  const lines = [
    `You are ${input.botName}, a Bot in a Dostigus Cluster.`,
    'You are new. Ask and learn what this Bot is for.',
    'Keep the Manifest the user describes. Do not invent Skills or Module packages.',
    `Manifest: name=${input.manifest.name}; Model tier=${input.manifest.modelTier}; Skills=${skills}; Module packages=${modules}.`,
  ]
  for (const skill of input.skills ?? []) {
    if (skill.instructions.trim()) {
      lines.push(`Skill ${skill.id}: ${skill.instructions.trim()}`)
    }
  }
  if (input.botId) {
    lines.push(`This Chat is with Bot id=${input.botId}.`)
  }
  if (input.tools && input.messagesOnly) {
    lines.push(
      'You may call tools to list and append Chat messages for this Bot.',
      'You may manage Schedules for this person and this Bot (daily or weekly wall-clock time) and you may read the Cluster timezone. You cannot set the Cluster timezone.',
      'Do not create, rename, or delete Bots.',
      'Prefer tools over guessing Store state.',
      'The Host already stores this Chat turn; do not append it again unless asked.',
    )
  } else if (input.tools && input.creatorManifest) {
    lines.push(
      'You may call tools to list and append Chat messages for this Bot, and to update this Bot\'s name, label, description, and Skills.',
      'You may manage Schedules for this person and this Bot (daily or weekly wall-clock time) and you may read the Cluster timezone. You cannot set the Cluster timezone.',
      'Do not create or delete Bots. Do not change a Bot you did not create.',
      'Prefer tools over guessing Store state.',
      'The Host already stores this Chat turn; do not append it again unless asked.',
      'You cannot delete Bots from Chat.',
    )
  } else if (input.tools) {
    lines.push(
      'You may call Cluster MCP surface tools to read and write Bots and Chat messages in this Owner Cluster.',
      'You may manage Schedules for this person and this Bot (daily or weekly wall-clock time in the Cluster timezone) and you may read or set the Cluster timezone.',
      'Stay on this Bot\'s purpose. This Cluster has one Owner.',
      'Prefer tools over guessing Store state.',
      'The Host already stores this Chat turn; do not append it again unless asked.',
      'You cannot delete Bots from Chat.',
    )
  }
  lines.push(
    CHAT_SELF_SETTINGS_RULE,
    CHAT_NO_PACKAGE_RULE,
    'Do not offer to write Module packages — that is the Builder.',
    'Reply briefly and stay in character.',
  )
  return lines.join(' ')
}

export function emptyLlmGatewayStored(): LlmGatewayStored {
  return {
    baseUrl: null,
    apiKey: null,
    defaultTier: DEFAULT_MODEL_TIER,
    modelOverrides: {},
  }
}

/** Strip trailing slashes so stored OpenRouter URLs match the default. */
export function normalizeGatewayBaseUrl(value: string | null | undefined): string | null {
  let normalized = trimOrUndefined(value)
  if (!normalized) {
    return null
  }
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized || null
}

export function llmGatewayPresetFromBaseUrl(
  baseUrl: string | null | undefined,
): LlmGatewayPreset {
  const normalized = normalizeGatewayBaseUrl(baseUrl)
  if (!normalized || normalized === OPENROUTER_DEFAULT_BASE_URL) {
    return 'openrouter'
  }
  return 'custom'
}

/** OpenRouter is the default Settings path. Custom keeps the typed URL. */
export function baseUrlForLlmGatewayPreset(
  preset: LlmGatewayPreset,
  customBaseUrl?: string | null,
): string | null {
  if (preset === 'openrouter') {
    return OPENROUTER_DEFAULT_BASE_URL
  }
  return normalizeGatewayBaseUrl(customBaseUrl)
}
