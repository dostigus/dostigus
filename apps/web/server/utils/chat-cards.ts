import type { ChatPartCard } from '@dostigus/shared'
import { CHAT_PART_LABEL_MAX, CHAT_PARTS_MAX } from '@dostigus/shared'

/**
 * Schedule Cards the Host injects onto the assistant line of one turn.
 * One Card per Schedule id; the last successful tool for that id sets the body.
 * Skill and self-settings success is a system Chat line, not a Card.
 * See ADR 0030.
 */

const SCHEDULE_ACTIONS: ChatPartCard['actions'] = [
  { label: 'Pause', action: { type: 'openSheet', sheetId: 'schedule' } },
  { label: 'Изменить', action: { type: 'openSheet', sheetId: 'schedule' } },
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

export class ChatCardTurn {
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
  }
}
