import type { ChatPartCard } from '@dostigus/shared'
import { CHAT_PART_LABEL_MAX, CHAT_PARTS_MAX } from '@dostigus/shared'

/**
 * Chat Cards the Host injects onto the assistant line of one turn.
 * One Card per Schedule id, one per Skill id, and one self-settings
 * Card per Bot id. The last successful tool for that id sets the body.
 * See ADR 0030.
 */

const SCHEDULE_ACTIONS: ChatPartCard['actions'] = [
  { label: 'Pause', action: { type: 'openSheet', sheetId: 'schedule' } },
  { label: 'Изменить', action: { type: 'openSheet', sheetId: 'schedule' } },
]

const SKILL_ACTIONS: ChatPartCard['actions'] = [
  { label: 'Изменить', action: { type: 'openSheet', sheetId: 'skill' } },
]

const BOT_ACTIONS: ChatPartCard['actions'] = [
  { label: 'Изменить', action: { type: 'openSheet', sheetId: 'bot' } },
]

export type ScheduleCardSource = {
  id: string
  cadence: string
  timeLocal: string
  daysOfWeek: string[] | null
  wakeText: string
}

export type ScheduleCardOutcome = 'create' | 'update' | 'resume' | 'already' | 'pause' | 'delete'

export function scheduleCardTitle(schedule: Pick<ScheduleCardSource, 'cadence' | 'timeLocal' | 'daysOfWeek'>): string {
  if (schedule.cadence === 'weekly') {
    const days = (schedule.daysOfWeek ?? []).join(' ')
    const title = days ? `weekly ${days} ${schedule.timeLocal}` : `weekly ${schedule.timeLocal}`
    if (title.length <= CHAT_PART_LABEL_MAX) {
      return title
    }
    return `weekly ${schedule.timeLocal}`
  }
  return `daily ${schedule.timeLocal}`
}

function fittedWake(schedule: ScheduleCardSource, title: string): string {
  const wake = schedule.wakeText.trim()
  if (wake && wake.length <= CHAT_PART_LABEL_MAX) {
    return wake
  }
  return title
}

function fittedTitle(value: string): string | null {
  const text = value.trim()
  if (!text) {
    return null
  }
  if (text.length <= CHAT_PART_LABEL_MAX) {
    return text
  }
  return text.slice(0, CHAT_PART_LABEL_MAX)
}

export function scheduleChatCard(schedule: ScheduleCardSource, outcome: ScheduleCardOutcome): ChatPartCard {
  const title = scheduleCardTitle(schedule)
  if (outcome === 'delete') {
    return {
      kind: 'card',
      card: 'schedule',
      title,
      body: 'Удалено',
      tone: 'warn',
      targetId: schedule.id,
      actions: [],
    }
  }
  if (outcome === 'pause') {
    return {
      kind: 'card',
      card: 'schedule',
      title,
      body: 'На паузе',
      tone: 'warn',
      targetId: schedule.id,
      actions: SCHEDULE_ACTIONS,
    }
  }
  if (outcome === 'already') {
    return {
      kind: 'card',
      card: 'schedule',
      title,
      body: 'уже стоит',
      tone: 'ok',
      targetId: schedule.id,
      actions: SCHEDULE_ACTIONS,
    }
  }
  return {
    kind: 'card',
    card: 'schedule',
    title,
    body: fittedWake(schedule, title),
    tone: 'ok',
    targetId: schedule.id,
    actions: SCHEDULE_ACTIONS,
  }
}

/** First non-empty line when it fits the part label cap. Otherwise «записан». */
export function skillCardBody(instructions: string): string {
  const line = instructions.split(/\r?\n/).map((part) => part.trim()).find((part) => part.length > 0) ?? ''
  if (line.length > 0 && line.length <= CHAT_PART_LABEL_MAX) {
    return line
  }
  return 'записан'
}

export function skillChatCard(
  skill: { id: string, instructions: string },
  outcome: 'upsert' | 'delete',
): ChatPartCard | null {
  const title = fittedTitle(skill.id)
  if (!title) {
    return null
  }
  if (outcome === 'delete') {
    return {
      kind: 'card',
      card: 'skill',
      title,
      body: 'Удалено',
      tone: 'warn',
      targetId: skill.id.trim(),
      actions: [],
    }
  }
  return {
    kind: 'card',
    card: 'skill',
    title,
    body: skillCardBody(skill.instructions),
    tone: 'ok',
    targetId: skill.id.trim(),
    actions: SKILL_ACTIONS,
  }
}

/** Label when it is set and fits the cap. Otherwise «обновлено». */
export function botCardBody(label: string): string {
  const text = label.trim()
  if (text.length > 0 && text.length <= CHAT_PART_LABEL_MAX) {
    return text
  }
  return 'обновлено'
}

export function botChatCard(bot: { id: string, name: string, label: string }): ChatPartCard | null {
  const title = fittedTitle(bot.name)
  const targetId = bot.id.trim()
  if (!title || !targetId) {
    return null
  }
  return {
    kind: 'card',
    card: 'bot',
    title,
    body: botCardBody(bot.label),
    tone: 'ok',
    targetId,
    actions: BOT_ACTIONS,
  }
}

export class ChatCardTurn {
  private cards = new Map<string, ChatPartCard>()

  note(card: ChatPartCard): void {
    if (card.card !== 'schedule' && card.card !== 'skill' && card.card !== 'bot') {
      return
    }
    this.cards.set(`${card.card}:${card.targetId}`, card)
  }

  parts(): ChatPartCard[] {
    return [...this.cards.values()].slice(0, CHAT_PARTS_MAX)
  }
}

function asSchedule(value: unknown): ScheduleCardSource | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.cadence !== 'string' || typeof row.timeLocal !== 'string') {
    return null
  }
  const days = Array.isArray(row.daysOfWeek)
    ? row.daysOfWeek.filter((item): item is string => typeof item === 'string')
    : null
  return {
    id: row.id,
    cadence: row.cadence,
    timeLocal: row.timeLocal,
    daysOfWeek: days,
    wakeText: typeof row.wakeText === 'string' ? row.wakeText : '',
  }
}

function asSkillList(value: unknown): Array<{ id: string, instructions: string }> {
  if (!Array.isArray(value)) {
    return []
  }
  const skills: Array<{ id: string, instructions: string }> = []
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.instructions !== 'string') {
      continue
    }
    skills.push({ id: row.id, instructions: row.instructions })
  }
  return skills
}

function asBotCardSource(value: unknown): { id: string, name: string, label: string } | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const bot = (value as { bot?: unknown }).bot
  if (!bot || typeof bot !== 'object') {
    return null
  }
  const row = bot as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.name !== 'string') {
    return null
  }
  const manifest = row.manifest
  const label = manifest && typeof manifest === 'object' && typeof (manifest as { label?: unknown }).label === 'string'
    ? (manifest as { label: string }).label
    : ''
  return { id: row.id, name: row.name, label }
}

function selfSettingsTouched(args: Record<string, unknown> | undefined): boolean {
  if (!args) {
    return false
  }
  return args.name !== undefined || args.label !== undefined || args.description !== undefined
}

function skillIdFromArgs(args: Record<string, unknown> | undefined): string {
  return typeof args?.id === 'string' ? args.id.trim() : ''
}

/** Record a Card from a successful Schedule, Skill, or self-settings tool. */
export function noteToolCard(
  turn: ChatCardTurn,
  name: string,
  result: unknown,
  args?: Record<string, unknown>,
): void {
  if (!result || typeof result !== 'object') {
    return
  }
  const record = result as Record<string, unknown>
  if (name === 'dostigus_schedules_list') {
    if (record.already === true) {
      const schedule = asSchedule(record.schedule)
      if (schedule) {
        turn.note(scheduleChatCard(schedule, 'already'))
      }
    }
    return
  }
  if (name === 'dostigus_schedules_create') {
    const schedule = asSchedule(record.schedule)
    if (schedule) {
      turn.note(scheduleChatCard(schedule, record.already === true ? 'already' : 'create'))
    }
    return
  }
  if (name === 'dostigus_schedules_update' || name === 'dostigus_schedules_resume') {
    const schedule = asSchedule(record.schedule)
    if (schedule) {
      turn.note(scheduleChatCard(schedule, name.endsWith('resume') ? 'resume' : 'update'))
    }
    return
  }
  if (name === 'dostigus_schedules_pause') {
    const schedule = asSchedule(record.schedule)
    if (schedule) {
      turn.note(scheduleChatCard(schedule, 'pause'))
    }
    return
  }
  if (name === 'dostigus_schedules_delete') {
    const schedule = asSchedule(record.schedule)
    if (schedule) {
      turn.note(scheduleChatCard(schedule, 'delete'))
    }
    return
  }
  if (name === 'dostigus_skills_list' || name === 'dostigus_bots_list' || name === 'dostigus_bots_get') {
    return
  }
  if (name === 'dostigus_skills_upsert') {
    const id = skillIdFromArgs(args)
    const skill = asSkillList(record.skills).find((item) => item.id === id)
    if (skill) {
      const card = skillChatCard(skill, 'upsert')
      if (card) {
        turn.note(card)
      }
    }
    return
  }
  if (name === 'dostigus_skills_delete') {
    const id = skillIdFromArgs(args)
    if (!id) {
      return
    }
    const card = skillChatCard({ id, instructions: '' }, 'delete')
    if (card) {
      turn.note(card)
    }
    return
  }
  if (name === 'dostigus_bots_update' && selfSettingsTouched(args)) {
    const bot = asBotCardSource(record)
    if (!bot) {
      return
    }
    const card = botChatCard(bot)
    if (card) {
      turn.note(card)
    }
  }
}
