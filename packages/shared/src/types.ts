/** Stable glossary types — names match CONTEXT.md. Do not invent synonyms. */

import type { Artifact } from './artifacts'
import type { BotAccentHex, BotAvatarShape } from './bot-avatar'
import type { ChatPart } from './chat-parts'

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

export type MemberId = string

/** Household account under the single Owner. Not a second Owner. */
export type Member = {
  id: MemberId
  displayName: string
  email: string | null
  username: string | null
  createdAt: string
  disabledAt: string | null
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
  /** Catalog line. Empty on a legacy row until upsert or lazy meta backfill. */
  description: string
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
  /** Kit silhouette id — see ADR 0016. */
  avatarShape: BotAvatarShape
  /** One of the Bot accent palette hexes — see ADR 0016. */
  avatarColor: BotAccentHex
  /** Optional short label. Empty when the Owner has not set one. */
  label: string
  /** Optional description. Empty when the Owner has not set one. */
  description: string
  skillIds: string[]
  modulePackageIds: ModulePackageId[]
}

export type Bot = {
  id: BotId
  name: string
  createdAt: string
  /** Owner or Member who created the Bot. */
  createdBy: string | null
  manifest: Manifest
}

/** One-line preview of the latest Chat line on a Bot. */
export type BotLastMessage = {
  content: string
  createdAt: string
}

/** Bot as shown in the Host list, with that preview. */
export type BotListItem = Bot & {
  lastMessage: BotLastMessage | null
}

export type MessageRole = 'user' | 'assistant' | 'system'

export const MESSAGE_ROLES = ['user', 'assistant', 'system'] as const

export type Message = {
  id: MessageId
  /** Set on a Bot's lines. Empty on a person line in a dm, group, or room. */
  botId: BotId | null
  role: MessageRole
  /** Markdown for an assistant line. Plain text for user and system. */
  content: string
  createdAt: string
  /** Owner id or Member id on Host user lines. Empty for assistant, system, and Bearer `/mcp` writes. */
  personId: string | null
  /**
   * Kit parts on an assistant line (button, status). Empty for user and system.
   * See ADR 0025.
   */
  parts: ChatPart[]
  /**
   * Joined Artifacts on this line. Empty when none. Not `parts_json`.
   * See ADR 0034.
   */
  artifacts?: Artifact[]
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

/** The Owner and Members on one Cluster. Membership rows are Members, not a separate Household table. */
export type Household = {
  id: HouseholdId
  clusterId: ClusterId
}

export type InviteId = string

/**
 * Household Invite before it becomes a Member.
 * The raw token is not part of this type — the Store keeps a hash.
 */
export type Invite = {
  id: InviteId
  email: string
  expiresAt: string
  createdAt: string
  usedAt: string | null
  revokedAt: string | null
}

export type ShareLink = {
  token: string
  objectId: string
}

/** First Chat line when a Bot is created (or first opened with no messages). */
export function botGreetingContent(name: string): string {
  return `Hello — I'm ${name}.`
}

/**
 * Purpose Card in Chat until the first user message.
 * Not a Manifest field — see ADR 0019.
 */
export const BOT_PURPOSE_PROMPT = 'What should this Bot be for?'

export const BOT_PURPOSE_HINT = 'One main thing — I\'ll tune from there.'

export const BOT_PURPOSE_OPTIONS = ['Personal', 'Work', 'Learning', 'Other'] as const

export type BotPurposeOption = (typeof BOT_PURPOSE_OPTIONS)[number]
