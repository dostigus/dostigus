import type { OpenedStore } from '@dostigus/db'
import type { BotViewer } from '@dostigus/shared'
import { insertMessage } from '@dostigus/db'
import { CHAT_PART_LABEL_MAX } from '@dostigus/shared'

/**
 * Host-written system line after a successful Skill or self-settings tool.
 * Same family as a Wake: plain string, no parts, on that person's bot-thread.
 * Not a Chat Card. See ADR 0030.
 */

function fittedFragment(value: string, fallback: string): string {
  const text = value.trim()
  if (text.length > 0 && text.length <= CHAT_PART_LABEL_MAX) {
    return text
  }
  return fallback
}

function firstInstructionLine(instructions: string): string {
  const line = instructions.split(/\r?\n/).map((part) => part.trim()).find((part) => part.length > 0) ?? ''
  return fittedFragment(line, 'записан')
}

function skillIdFromArgs(args: Record<string, unknown> | undefined): string {
  return typeof args?.id === 'string' ? args.id.trim() : ''
}

function skillInstructions(result: unknown, id: string): string {
  if (!result || typeof result !== 'object') {
    return ''
  }
  const skills = (result as { skills?: unknown }).skills
  if (!Array.isArray(skills)) {
    return ''
  }
  for (const item of skills) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as { id?: unknown, instructions?: unknown }
    if (row.id === id && typeof row.instructions === 'string') {
      return row.instructions
    }
  }
  return ''
}

function botNoticeSource(result: unknown): { name: string, label: string } | null {
  if (!result || typeof result !== 'object') {
    return null
  }
  const bot = (result as { bot?: unknown }).bot
  if (!bot || typeof bot !== 'object') {
    return null
  }
  const row = bot as { name?: unknown, manifest?: { label?: unknown } }
  if (typeof row.name !== 'string' || !row.name.trim()) {
    return null
  }
  const label = row.manifest && typeof row.manifest.label === 'string' ? row.manifest.label : ''
  return { name: row.name.trim(), label }
}

function selfSettingsTouched(args: Record<string, unknown> | undefined): boolean {
  if (!args) {
    return false
  }
  return args.name !== undefined || args.label !== undefined || args.description !== undefined
}

/** One short line, or null when this tool does not announce. */
export function selfSettingsNoticeText(
  name: string,
  result: unknown,
  args?: Record<string, unknown>,
): string | null {
  if (name === 'dostigus_skills_upsert') {
    const id = skillIdFromArgs(args)
    if (!id) {
      return null
    }
    return `Skill · ${id} · ${firstInstructionLine(skillInstructions(result, id))}`
  }
  if (name === 'dostigus_skills_delete') {
    const id = skillIdFromArgs(args)
    if (!id) {
      return null
    }
    return `Skill · ${id} · Удалено`
  }
  if (name === 'dostigus_bots_update' && selfSettingsTouched(args)) {
    const bot = botNoticeSource(result)
    if (!bot) {
      return null
    }
    return `Бот · ${bot.name} · ${fittedFragment(bot.label, 'обновлено')}`
  }
  return null
}

/** Append one system line per successful tool. Does not rewrite an earlier line. */
export function writeSelfSettingsNotice(input: {
  store: OpenedStore
  personId?: string
  role?: 'owner' | 'member'
  turnBotId?: string
  name: string
  result: unknown
  args?: Record<string, unknown>
}): void {
  if (!input.personId || !input.turnBotId) {
    return
  }
  const content = selfSettingsNoticeText(input.name, input.result, input.args)
  if (!content) {
    return
  }
  const viewer: BotViewer = {
    id: input.personId,
    role: input.role === 'member' ? 'member' : 'owner',
  }
  insertMessage(input.store, {
    botId: input.turnBotId,
    role: 'system',
    content,
    viewer,
  })
}
