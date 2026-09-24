import type { Bot, BotAccentHex, BotAvatarShape, Invite, Member, Message, MessageRole, ModelTier, Owner, Skill } from '@dostigus/shared'
import {
  chatPartsForRole,
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
  label: string
  description: string
  skills_json: string
  modules_json: string
  created_at: number
  created_by: string | null
}

export type MessageRecord = {
  id: string
  bot_id: string | null
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

/**
 * `bots.skills_json` is a JSON array of Skill objects `{ id, instructions }`.
 * A legacy array of id strings still reads as ids with empty instructions.
 * `Manifest.skillIds` is those ids. See ADR 0028.
 */
export function skillsFromJson(raw: string): Skill[] {
  let value: unknown
  try {
    value = JSON.parse(raw) as unknown
  } catch {
    return []
  }
  if (!Array.isArray(value)) {
    return []
  }
  const skills: Skill[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item === 'string') {
      const id = item.trim()
      if (!id || seen.has(id)) {
        continue
      }
      seen.add(id)
      skills.push({ id, instructions: '' })
      continue
    }
    if (!item || typeof item !== 'object') {
      continue
    }
    const record = item as { id?: unknown, instructions?: unknown }
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    if (!id || seen.has(id)) {
      continue
    }
    const instructions = typeof record.instructions === 'string' ? record.instructions : ''
    seen.add(id)
    skills.push({ id, instructions })
  }
  return skills
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
    createdBy: row.created_by ?? null,
    manifest: {
      name: row.name,
      modelTier: modelTierFromRow(row.model_tier),
      avatarShape: avatarShapeFromRow(row.avatar_shape),
      avatarColor: avatarColorFromRow(row.avatar_color),
      label: row.label ?? '',
      description: row.description ?? '',
      skillIds: skillsFromJson(row.skills_json).map((skill) => skill.id),
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
