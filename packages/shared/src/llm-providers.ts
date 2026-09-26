/** Provider instances, Model-tier Policy resolve, and escalate plan. See ADR 0036. */

import type { LlmGatewayEnv, LlmGatewayStored } from './llm-gateway'
import type { ModelTier } from './types'
import {
  DEFAULT_TIER_MODELS,
  normalizeGatewayBaseUrl,
  OPENROUTER_DEFAULT_BASE_URL,
  trimOrUndefined,
} from './llm-gateway'
import { MODEL_TIERS } from './types'

export const LLM_PROVIDER_KINDS = ['openrouter', 'openai', 'openai-compatible'] as const

export type LlmProviderKind = (typeof LLM_PROVIDER_KINDS)[number]

export const LLM_POLICY_KINDS = ['free', 'auto', 'model'] as const

export type LlmPolicyKind = (typeof LLM_POLICY_KINDS)[number]

export type LlmPolicy
  = { kind: 'free' }
    | { kind: 'auto' }
    | { kind: 'model', modelId: string }

export type LlmProviderInstance = {
  id: string
  kind: LlmProviderKind
  apiKey: string | null
  baseUrl: string | null
  defaultModel: string | null
}

export type LlmTierBind = {
  providerId: string
  policy: LlmPolicy
}

export type LlmProviderPublic = {
  id: string
  kind: LlmProviderKind
  baseUrl: string | null
  hasApiKey: boolean
  apiKeyMasked: string | null
  defaultModel: string | null
}

/** Verified against OpenRouter Free Models Router docs (2026). */
export const OPENROUTER_FREE_MODEL_ID = 'openrouter/free' as const

/** Verified against OpenRouter Auto Router docs (2026). */
export const OPENROUTER_AUTO_MODEL_ID = 'openrouter/auto' as const

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1' as const

/** Settings default once for a sole official OpenAI Provider. Not a catalog. */
export const OPENAI_SETTINGS_DEFAULT_MODEL = 'gpt-4o' as const

export const LEGACY_LLM_PROVIDER_ID = 'legacy' as const

export const ENV_LLM_PROVIDER_ID = 'env' as const

export const ESCALATE_CHAIN = ['cheap', 'strong', 'code'] as const

export const LLM_TIER_ATTEMPTS_MAX = 3

export const LLM_PROVIDER_KIND_LABELS: Record<LlmProviderKind, string> = {
  'openrouter': 'OpenRouter',
  'openai': 'OpenAI',
  'openai-compatible': 'OpenAI-compatible',
}

export const LLM_POLICY_LABELS: Record<LlmPolicyKind, string> = {
  free: 'Free',
  auto: 'Auto',
  model: 'Model',
}

export type LlmSituation = 'chat' | 'user' | 'mention' | 'wake'

export type ResolvedLlmAttempt = {
  modelId: string
  modelTier: ModelTier
  providerId: string
  kind: LlmProviderKind
  baseUrl: string
  apiKey: string
  policy: LlmPolicy
  attemptKey: string
}

export function isLlmProviderKind(value: string): value is LlmProviderKind {
  return (LLM_PROVIDER_KINDS as readonly string[]).includes(value)
}

export function isLlmPolicyKind(value: string): value is LlmPolicyKind {
  return (LLM_POLICY_KINDS as readonly string[]).includes(value)
}

export function startTierForSituation(situation: LlmSituation): ModelTier {
  return situation === 'wake' ? 'cheap' : 'strong'
}

export function escalateTiersFrom(start: ModelTier): ModelTier[] {
  if (start === 'toy') {
    return ['toy']
  }
  const index = (ESCALATE_CHAIN as readonly ModelTier[]).indexOf(start)
  if (index < 0) {
    return [start]
  }
  return ESCALATE_CHAIN.slice(index).slice()
}

export function inferLlmProviderKind(baseUrl: string | null | undefined): LlmProviderKind {
  const normalized = normalizeGatewayBaseUrl(baseUrl)
  if (!normalized || normalized === OPENROUTER_DEFAULT_BASE_URL) {
    return 'openrouter'
  }
  const host = hostnameOf(normalized)
  if (host === 'openrouter.ai' || host.endsWith('.openrouter.ai')) {
    return 'openrouter'
  }
  if (host === 'api.openai.com') {
    return 'openai'
  }
  return 'openai-compatible'
}

export function defaultBaseUrlForKind(
  kind: LlmProviderKind,
  baseUrl?: string | null,
): string | null {
  const explicit = normalizeGatewayBaseUrl(baseUrl)
  if (kind === 'openrouter') {
    return explicit ?? OPENROUTER_DEFAULT_BASE_URL
  }
  if (kind === 'openai') {
    return explicit ?? OPENAI_DEFAULT_BASE_URL
  }
  return explicit
}

export function modelIdForPolicy(
  policy: LlmPolicy,
  provider?: Pick<LlmProviderInstance, 'kind' | 'defaultModel'> | null,
): string {
  if (policy.kind === 'free') {
    return OPENROUTER_FREE_MODEL_ID
  }
  if (policy.kind === 'auto') {
    return OPENROUTER_AUTO_MODEL_ID
  }
  const pinned = trimOrUndefined(policy.modelId)
  if (pinned) {
    return pinned
  }
  const shared = trimOrUndefined(provider?.defaultModel)
  if (shared) {
    return shared
  }
  if (provider?.kind === 'openai') {
    return OPENAI_SETTINGS_DEFAULT_MODEL
  }
  return ''
}

/** Compat: a stored / env model string is a pinned-model Policy. */
export function policyFromLegacyModel(modelId: string): LlmPolicy {
  return { kind: 'model', modelId: modelId.trim() }
}

export function attemptKeyFor(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`
}

export function autoFillEmptyTiers(input: {
  provider: LlmProviderInstance
  binds: Partial<Record<ModelTier, LlmTierBind>>
  pins?: Partial<Record<ModelTier, string>>
}): Partial<Record<ModelTier, LlmTierBind>> {
  const out: Partial<Record<ModelTier, LlmTierBind>> = { ...input.binds }
  const taken = (tier: ModelTier) => Boolean(
    out[tier] || trimOrUndefined(input.pins?.[tier]),
  )
  if (input.provider.kind === 'openrouter') {
    const free: LlmTierBind = {
      providerId: input.provider.id,
      policy: { kind: 'free' },
    }
    const auto: LlmTierBind = {
      providerId: input.provider.id,
      policy: { kind: 'auto' },
    }
    if (!taken('cheap')) {
      out.cheap = free
    }
    if (!taken('toy')) {
      out.toy = free
    }
    if (!taken('strong')) {
      out.strong = auto
    }
    if (!taken('code')) {
      out.code = auto
    }
    return out
  }
  const modelId = trimOrUndefined(input.provider.defaultModel)
    ?? (input.provider.kind === 'openai' ? OPENAI_SETTINGS_DEFAULT_MODEL : undefined)
  if (!modelId) {
    return out
  }
  const bind: LlmTierBind = {
    providerId: input.provider.id,
    policy: { kind: 'model', modelId },
  }
  for (const tier of MODEL_TIERS) {
    if (!taken(tier)) {
      out[tier] = bind
    }
  }
  return out
}

export function resolveLlmAttempt(
  tier: ModelTier,
  options: {
    env?: LlmGatewayEnv
    stored?: LlmGatewayStored | null
  } = {},
): ResolvedLlmAttempt | null {
  const stored = normalizeStored(options.stored)
  const env = options.env
  const envPin = trimOrUndefined(env?.model) ?? trimOrUndefined(env?.modelOverrides?.[tier])
  if (envPin) {
    const provider = envOrStoredProvider(env, stored)
    if (!provider) {
      return null
    }
    return configuredAttempt(tier, policyFromLegacyModel(envPin), provider, env)
  }

  const bind = stored.tierBinds[tier]
  if (bind) {
    const provider = providerById(stored.providers, bind.providerId)
    if (!provider) {
      return null
    }
    return configuredAttempt(tier, bind.policy, provider, env)
  }

  const storePin = trimOrUndefined(stored.modelOverrides[tier])
  const fallback = envOrStoredProvider(env, stored)
  if (storePin && fallback) {
    return configuredAttempt(tier, policyFromLegacyModel(storePin), fallback, env)
  }

  if (hasExplicitBinds(stored.tierBinds)) {
    return null
  }
  if (!fallback) {
    return null
  }
  return configuredAttempt(
    tier,
    policyFromLegacyModel(DEFAULT_TIER_MODELS[tier]),
    fallback,
    env,
  )
}

export function planEscalateAttempts(
  start: ModelTier,
  options: {
    env?: LlmGatewayEnv
    stored?: LlmGatewayStored | null
  } = {},
): ResolvedLlmAttempt[] {
  const seen = new Set<string>()
  const out: ResolvedLlmAttempt[] = []
  for (const tier of escalateTiersFrom(start)) {
    const attempt = resolveLlmAttempt(tier, options)
    if (!attempt) {
      continue
    }
    if (seen.has(attempt.attemptKey)) {
      continue
    }
    seen.add(attempt.attemptKey)
    out.push(attempt)
    if (out.length >= LLM_TIER_ATTEMPTS_MAX) {
      break
    }
  }
  return out
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function normalizeStored(stored?: LlmGatewayStored | null): {
  baseUrl: string | null
  modelOverrides: Partial<Record<ModelTier, string>>
  providers: LlmProviderInstance[]
  tierBinds: Partial<Record<ModelTier, LlmTierBind>>
} {
  return {
    baseUrl: stored?.baseUrl ?? null,
    modelOverrides: stored?.modelOverrides ?? {},
    providers: stored?.providers ?? [],
    tierBinds: stored?.tierBinds ?? {},
  }
}

function hasExplicitBinds(binds: Partial<Record<ModelTier, LlmTierBind>>): boolean {
  return MODEL_TIERS.some((tier) => Boolean(binds[tier]))
}

function providerById(
  providers: LlmProviderInstance[],
  id: string,
): LlmProviderInstance | undefined {
  return providers.find((provider) => provider.id === id)
}

function envOrStoredProvider(
  env: LlmGatewayEnv | undefined,
  stored: {
    baseUrl: string | null
    providers: LlmProviderInstance[]
  },
): LlmProviderInstance | undefined {
  const envKey = trimOrUndefined(env?.apiKey)
  if (envKey) {
    const kind = inferLlmProviderKind(env?.baseUrl ?? stored.baseUrl)
    return {
      id: ENV_LLM_PROVIDER_ID,
      kind,
      apiKey: envKey,
      baseUrl: defaultBaseUrlForKind(kind, env?.baseUrl ?? stored.baseUrl),
      defaultModel: null,
    }
  }
  return stored.providers.find((provider) => trimOrUndefined(provider.apiKey))
}

function configuredAttempt(
  tier: ModelTier,
  policy: LlmPolicy,
  provider: LlmProviderInstance,
  env?: LlmGatewayEnv,
): ResolvedLlmAttempt | null {
  const envKey = trimOrUndefined(env?.apiKey)
  const providerId = envKey ? ENV_LLM_PROVIDER_ID : provider.id
  const kind = envKey
    ? inferLlmProviderKind(env?.baseUrl ?? provider.baseUrl)
    : provider.kind
  const apiKey = envKey ?? trimOrUndefined(provider.apiKey) ?? null
  const baseUrl = defaultBaseUrlForKind(
    kind,
    envKey ? (env?.baseUrl ?? provider.baseUrl) : provider.baseUrl,
  )
  const modelId = modelIdForPolicy(policy, provider)
  if (!apiKey || !baseUrl || !modelId) {
    return null
  }
  return {
    modelId,
    modelTier: tier,
    providerId,
    kind,
    baseUrl,
    apiKey,
    policy,
    attemptKey: attemptKeyFor(providerId, modelId),
  }
}
