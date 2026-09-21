/** Stable glossary types — names match CONTEXT.md. Do not invent synonyms. */

export type ClusterId = string
export type BotId = string
export type ModulePackageId = string
export type OwnerId = string
export type JobId = string
export type HouseholdId = string

export const PRODUCT_NAME = 'Dostigus' as const

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
  clusterId: ClusterId
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

export type Manifest = {
  botId: BotId
  persona: string
  skillIds: string[]
  modulePackageIds: ModulePackageId[]
  modelTier: ModelTier
}

export type Bot = {
  id: BotId
  clusterId: ClusterId
  slug: string
  displayName: string
  manifest: Manifest
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

export type LlmGateway = {
  providers: LlmProvider[]
  defaultTier: ModelTier
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
