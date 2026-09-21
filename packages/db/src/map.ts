import type { Bot, Message, MessageRole, ModelTier, Owner } from '@dostigus/shared'
import { DEFAULT_MODEL_TIER, isModelTier } from '@dostigus/shared'

export type BotRecord = {
  id: string
  name: string
  model_tier: string
  skills_json: string
  modules_json: string
  created_at: number
}

export type MessageRecord = {
  id: string
  bot_id: string
  role: string
  content: string
  created_at: number
}

function parseStringList(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) {
      return []
    }
    return value.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

export function modelTierFromRow(value: string): ModelTier {
  return isModelTier(value) ? value : DEFAULT_MODEL_TIER
}

export function toBot(row: BotRecord): Bot {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
    manifest: {
      name: row.name,
      modelTier: modelTierFromRow(row.model_tier),
      skillIds: parseStringList(row.skills_json),
      modulePackageIds: parseStringList(row.modules_json),
    },
  }
}

export type OwnerRecord = {
  id: string
  email: string | null
  username: string | null
  password_hash: string
  created_at: number
}

export function toOwner(row: OwnerRecord): Owner {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export function toMessage(row: MessageRecord): Message {
  return {
    id: row.id,
    botId: row.bot_id,
    role: row.role as MessageRole,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString(),
  }
}
