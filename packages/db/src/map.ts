import type { Bot, BotAccentHex, BotAvatarShape, BotVisibility, Invite, Member, Message, MessageRole, ModelTier, Owner } from '@dostigus/shared'
import {
  chatPartsForRole,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_MODEL_TIER,
  isBotVisibility,
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
  label: string
  description: string
  skills_json: string
  modules_json: string
  created_at: number
  visibility: string
  created_by: string | null
}

export type MessageRecord = {
  id: string
  bot_id: string
  role: string
  content: string
  created_at: number
  person_id: string | null
  parts_json: string
  thread_id: string | null
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

export function visibilityFromRow(value: string | null | undefined): BotVisibility {
  return value && isBotVisibility(value) ? value : 'shared'
}

export function toBot(row: BotRecord): Bot {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
    visibility: visibilityFromRow(row.visibility),
    createdBy: row.created_by ?? null,
    manifest: {
      name: row.name,
      modelTier: modelTierFromRow(row.model_tier),
      avatarShape: avatarShapeFromRow(row.avatar_shape),
      avatarColor: avatarColorFromRow(row.avatar_color),
      label: row.label ?? '',
      description: row.description ?? '',
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

export type InviteRecord = {
  id: string
  token_hash: string
  email: string
  expires_at: number
  created_by: string
  created_at: number
  used_at: number | null
  revoked_at: number | null
}

export function toInvite(row: InviteRecord): Invite {
  return {
    id: row.id,
    email: row.email,
    expiresAt: new Date(row.expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    usedAt: row.used_at == null ? null : new Date(row.used_at).toISOString(),
    revokedAt: row.revoked_at == null ? null : new Date(row.revoked_at).toISOString(),
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
    parts: chatPartsForRole(row.role, row.parts_json),
  }
}
