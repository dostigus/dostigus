/** Stable glossary types — names match CONTEXT.md. Do not invent synonyms. */

export type ClusterId = string
export type BotId = string
export type ModulePackageId = string

export type Cluster = {
  id: ClusterId
  name: string
}

export type Bot = {
  id: BotId
  clusterId: ClusterId
  slug: string
  displayName: string
}

export type ModulePackage = {
  id: ModulePackageId
  botId: BotId
  slug: string
}

export type SheetKind = 'sheet' | 'modal'

export type Sheet = {
  id: string
  title: string
  kind: SheetKind
}

export type ModelTier = 'cheap' | 'strong' | 'code'

export const MODEL_TIERS = ['cheap', 'strong', 'code'] as const

export type LlmProvider = 'openrouter' | 'anthropic' | 'openai' | 'ollama'

export type LlmGateway = {
  providers: LlmProvider[]
  defaultTier: ModelTier
}

export type McpContract = {
  tools: string[]
}

/** Later multi-user sharing of a Cluster. Not day-1. */
export type Household = {
  id: string
  clusterId: ClusterId
}
