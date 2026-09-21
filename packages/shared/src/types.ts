/** Stable glossary types — names match CONTEXT.md. Do not invent synonyms. */

export type ClusterId = string
export type BotId = string
export type ModulePackageId = string
export type OwnerId = string
export type JobId = string
export type HouseholdId = string
export type MessageId = string

export const PRODUCT_NAME = 'Dostigus' as const

export const DEFAULT_BOT_NAME = 'New Bot' as const

export type Platform = {
  repo: 'dostigus/dostigus'
}

export type Cluster = {
  id: ClusterId
  name: string
  ownerId: OwnerId
}

export type Owner = {
  id: OwnerId
  email: string | null
  username: string | null
  createdAt: string
}

/** Host shell is a synonym — prefer Host. */
export type Host = {
  kind: 'web' | 'pwa'
}

export type Chat = {
  botId: BotId
}

export type CardKind = 'button' | 'table' | 'status'

export type Card = {
  id: string
  kind: CardKind
}

export type SheetKind = 'sheet' | 'modal'

export type Sheet = {
  id: string
  title: string
  kind: SheetKind
}

export type Kit = {
  components: string[]
}

export type Skill = {
  id: string
  instructions: string
}

export type ModelTier = 'cheap' | 'strong' | 'code' | 'toy'

export const MODEL_TIERS = ['cheap', 'strong', 'code', 'toy'] as const

export const DEFAULT_MODEL_TIER: ModelTier = 'strong'

/** Short Host labels. Values stay the glossary Model tier names. */
export const MODEL_TIER_LABELS: Record<ModelTier, string> = {
  cheap: 'Cheap — everyday replies',
  strong: 'Strong — best quality',
  code: 'Code — technical work',
  toy: 'Toy — experimental',
}

export function isModelTier(value: string): value is ModelTier {
  return (MODEL_TIERS as readonly string[]).includes(value)
}

export type Manifest = {
  name: string
  modelTier: ModelTier
  skillIds: string[]
  modulePackageIds: ModulePackageId[]
}

export type Bot = {
  id: BotId
  name: string
  createdAt: string
  manifest: Manifest
}

export type MessageRole = 'user' | 'assistant' | 'system'

export const MESSAGE_ROLES = ['user', 'assistant', 'system'] as const

export type Message = {
  id: MessageId
  botId: BotId
  role: MessageRole
  content: string
  createdAt: string
}

export type Orchestrator = Bot & {
  role: 'orchestrator'
}

export type Builder = {
  id: string
  clusterId: ClusterId
}

export type ModulePackage = {
  id: ModulePackageId
  slug: string
  version: string
}

export type Store = {
  clusterId: ClusterId
}

export type McpSurface = {
  tools: string[]
}

/** Interface definition of an MCP surface. Prefer McpSurface. */
export type McpContract = McpSurface

export type Job = {
  id: JobId
  clusterId: ClusterId
  requestedFeature: string
}

export type Apply = {
  jobId: JobId
  modulePackageId: ModulePackageId
}

export type LlmProvider = 'openrouter' | 'anthropic' | 'openai' | 'ollama'

export type LlmGatewayModelOverrides = Partial<Record<ModelTier, string>>

export type LlmGateway = {
  providers: LlmProvider[]
  defaultTier: ModelTier
  baseUrl?: string
  modelOverrides?: LlmGatewayModelOverrides
}

/** Later scoped membership. Not day-1. */
export type Household = {
  id: HouseholdId
  clusterId: ClusterId
}

export type ShareLink = {
  token: string
  objectId: string
}

/** First Chat line when a Bot is created (or first opened with no messages). */
export function botGreetingContent(name: string): string {
  return `Hello — I'm ${name}. I don't have a purpose yet. What should this Bot be for?`
}
