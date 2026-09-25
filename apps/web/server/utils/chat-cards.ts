import type { ChatPartCard } from '@dostigus/shared'
import type { HostLocale } from '@dostigus/ui-kit/locale'
import { CHAT_PART_LABEL_MAX, CHAT_PARTS_MAX } from '@dostigus/shared'
import { DEFAULT_HOST_LOCALE, tHost } from '@dostigus/ui-kit/locale'

/**
 * Schedule Cards the Host injects onto the assistant line of one turn.
 * One Card per Schedule id; the last successful tool for that id sets the body.
 * Skill and self-settings success is a system Chat line, not a Card.
 * See ADR 0030.
 */

function scheduleActions(locale: HostLocale): ChatPartCard['actions'] {
  return [
    { label: tHost(locale, 'chat.card.schedule.pause'), action: { type: 'openSheet', sheetId: 'schedule' } },
    { label: tHost(locale, 'chat.card.schedule.edit'), action: { type: 'openSheet', sheetId: 'schedule' } },
  ]
}

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

export function scheduleChatCard(
  schedule: ScheduleCardSource,
  outcome: ScheduleCardOutcome,
  locale: HostLocale = DEFAULT_HOST_LOCALE,
): ChatPartCard {
  const title = scheduleCardTitle(schedule)
  const actions = scheduleActions(locale)
  if (outcome === 'delete') {
    return {
      kind: 'card',
      card: 'schedule',
      title,
      body: tHost(locale, 'chat.card.schedule.deleted'),
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
      body: tHost(locale, 'chat.card.schedule.paused'),
      tone: 'warn',
      targetId: schedule.id,
      actions,
    }
  }
  if (outcome === 'already') {
    return {
      kind: 'card',
      card: 'schedule',
      title,
      body: tHost(locale, 'chat.card.schedule.already'),
      tone: 'ok',
      targetId: schedule.id,
      actions,
    }
  }
  return {
    kind: 'card',
    card: 'schedule',
    title,
    body: fittedWake(schedule, title),
    tone: 'ok',
    targetId: schedule.id,
    actions,
  }
}

export class ChatCardTurn {
  constructor(readonly locale: HostLocale = DEFAULT_HOST_LOCALE) {}

  private scheduleCards = new Map<string, ChatPartCard>()

  note(card: ChatPartCard): void {
    if (card.card !== 'schedule') {
      return
    }
    this.scheduleCards.set(card.targetId, card)
  }

  parts(): ChatPartCard[] {
    return [...this.scheduleCards.values()].slice(0, CHAT_PARTS_MAX)
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

/** Record a Card from a successful Schedule tool. A list with no intent writes nothing. */
export function noteToolCard(turn: ChatCardTurn, name: string, result: unknown): void {
  if (!result || typeof result !== 'object') {
    return
  }
  const record = result as Record<string, unknown>
  if (name === 'dostigus_schedules_list') {
    if (record.already === true) {
      const schedule = asSchedule(record.schedule)
      if (schedule) {
        turn.note(scheduleChatCard(schedule, 'already', turn.locale))
      }
    }
    return
  }
  if (name === 'dostigus_schedules_create') {
    const schedule = asSchedule(record.schedule)
    if (schedule) {
      turn.note(scheduleChatCard(schedule, record.already === true ? 'already' : 'create', turn.locale))
    }
    return
  }
  if (name === 'dostigus_schedules_update' || name === 'dostigus_schedules_resume') {
    const schedule = asSchedule(record.schedule)
    if (schedule) {
      turn.note(scheduleChatCard(schedule, name.endsWith('resume') ? 'resume' : 'update', turn.locale))
    }
    return
  }
  if (name === 'dostigus_schedules_pause') {
    const schedule = asSchedule(record.schedule)
    if (schedule) {
      turn.note(scheduleChatCard(schedule, 'pause', turn.locale))
    }
    return
  }
  if (name === 'dostigus_schedules_delete') {
    const schedule = asSchedule(record.schedule)
    if (schedule) {
      turn.note(scheduleChatCard(schedule, 'delete', turn.locale))
    }
  }
}
