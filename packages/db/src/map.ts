import type { Bot, BotAccentHex, BotAvatarShape, Member, Message, MessageRole, ModelTier, Owner } from '@dostigus/shared'
import {
  DEFAULT_AVATAR_COLOR,
  DEFAULT_MODEL_TIER,
  isModelTier,
  migrateBotAvatarShape,
  normalizeBotAccentHex,
} from '@dostigus/shared'

export type BotRecord = {
  id: string
  name: string
  model_tier: string
  avatar_shape: string
  avatar_color: string
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
  person_id: string | null
}

export type MemberRecord = {
  id: string
  display_name: string
  email: string | null
  username: string | null
  password_hash: string
  created_at: number
  disabled_at: number | null
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

export function avatarShapeFromRow(value: string): BotAvatarShape {
  return migrateBotAvatarShape(value)
}

export function avatarColorFromRow(value: string): BotAccentHex {
  return normalizeBotAccentHex(value) ?? DEFAULT_AVATAR_COLOR
}

export function toBot(row: BotRecord): Bot {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
    manifest: {
      name: row.name,
      modelTier: modelTierFromRow(row.model_tier),
      avatarShape: avatarShapeFromRow(row.avatar_shape),
      avatarColor: avatarColorFromRow(row.avatar_color),
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

export function toMember(row: MemberRecord): Member {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    username: row.username,
    createdAt: new Date(row.created_at).toISOString(),
    disabledAt: row.disabled_at == null ? null : new Date(row.disabled_at).toISOString(),
  }
}

export function toMessage(row: MessageRecord): Message {
  return {
    id: row.id,
    botId: row.bot_id,
    role: row.role as MessageRole,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString(),
    personId: row.person_id ?? null,
  }
}
