import type { OpenedStore, Schedule, ScheduleCadence, ScheduleWeekday } from '@dostigus/db'
import type { BotViewer } from '@dostigus/shared'
import process from 'node:process'
import {
  createSchedule,
  deleteSchedule,
  effectiveClusterTimeZone,
  findEnabledEquivalentSchedule,
  getSchedule,
  listSchedules,
  pauseSchedule,
  personMayOpenBot,
  requireBot,
  resumeSchedule,
  setClusterTimeZone,
  StoreError,
  updateSchedule,
  viewerMaySeeBot,
} from '@dostigus/db'

export type ScheduleToolContext = {
  turnBotId?: string
}

function actorMayManage(schedulePersonId: string, viewer?: BotViewer): boolean {
  if (!viewer || viewer.role === 'owner') {
    return true
  }
  return schedulePersonId === viewer.id
}

function assertTurnBot(botId: string, ctx?: ScheduleToolContext): void {
  if (ctx?.turnBotId && ctx.turnBotId !== botId) {
    throw new StoreError('Schedules on this turn stay on this Bot', 403)
  }
}

function assertMemberCanSeeBot(store: OpenedStore, botId: string, viewer?: BotViewer): void {
  if (!viewer || viewer.role === 'owner') {
    return
  }
  const bot = requireBot(store, botId)
  if (!viewerMaySeeBot(store, bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
}

function requireManagedSchedule(store: OpenedStore, id: string, viewer?: BotViewer, ctx?: ScheduleToolContext) {
  const schedule = getSchedule(store, id)
  if (!schedule || !actorMayManage(schedule.personId, viewer)) {
    throw new StoreError('Schedule not found', 404)
  }
  assertTurnBot(schedule.botId, ctx)
  assertMemberCanSeeBot(store, schedule.botId, viewer)
  return schedule
}

function personForCreate(input: Record<string, unknown>, viewer?: BotViewer): string {
  const requested = typeof input.personId === 'string' ? input.personId.trim() : ''
  if (viewer?.role === 'member') {
    if (requested && requested !== viewer.id) {
      throw new StoreError('Schedule not found', 404)
    }
    return viewer.id
  }
  if (requested) {
    return requested
  }
  if (viewer?.id) {
    return viewer.id
  }
  throw new StoreError('Name the person for this Schedule', 400)
}

function readBotId(input: Record<string, unknown>): string {
  const botId = typeof input.botId === 'string' ? input.botId.trim() : ''
  if (!botId) {
    throw new StoreError('Bot not found', 404)
  }
  return botId
}

function readDays(input: Record<string, unknown>): string[] | undefined {
  if (input.daysOfWeek === undefined) {
    return undefined
  }
  if (!Array.isArray(input.daysOfWeek)) {
    throw new StoreError('daysOfWeek uses sun, mon, tue, wed, thu, fri, sat', 400)
  }
  return input.daysOfWeek.filter((item): item is string => typeof item === 'string')
}

export function schedulesList(
  store: OpenedStore,
  input: Record<string, unknown>,
  viewer?: BotViewer,
  ctx?: ScheduleToolContext,
) {
  const botId = readBotId(input)
  assertTurnBot(botId, ctx)
  assertMemberCanSeeBot(store, botId, viewer)
  const requested = typeof input.personId === 'string' ? input.personId.trim() : ''
  const personId = viewer?.role === 'member'
    ? viewer.id
    : (requested || viewer?.id || '')
  if (viewer?.role === 'member' && requested && requested !== viewer.id) {
    throw new StoreError('Schedule not found', 404)
  }
  const schedules = listSchedules(store, {
    botId,
    personId: viewer?.role === 'member' ? viewer.id : (requested || undefined),
  })
  if (input.intent === 'set') {
    if (!personId) {
      throw new StoreError('Name the person for this Schedule', 400)
    }
    const cadence = typeof input.cadence === 'string' ? input.cadence : ''
    const timeLocal = typeof input.timeLocal === 'string' ? input.timeLocal : ''
    if (!cadence || !timeLocal) {
      throw new StoreError('intent set needs cadence and timeLocal', 400)
    }
    const match = findEnabledEquivalentSchedule(store, {
      botId,
      personId,
      cadence,
      timeLocal,
      daysOfWeek: readDays(input) as ScheduleWeekday[] | undefined,
    })
    if (match) {
      return { schedules, already: true as const, schedule: match }
    }
  }
  return { schedules }
}

export function schedulesCreate(
  store: OpenedStore,
  input: Record<string, unknown>,
  viewer?: BotViewer,
  ctx?: ScheduleToolContext,
) {
  const botId = readBotId(input)
  assertTurnBot(botId, ctx)
  assertMemberCanSeeBot(store, botId, viewer)
  const personId = personForCreate(input, viewer)
  if (viewer?.role === 'member' && !personMayOpenBot(store, botId, personId)) {
    throw new StoreError('Bot not found', 404)
  }
  const cadence = input.cadence === 'weekly' ? 'weekly' : 'daily'
  const standing = findEnabledEquivalentSchedule(store, {
    botId,
    personId,
    cadence,
    timeLocal: String(input.timeLocal ?? ''),
    daysOfWeek: readDays(input) as ScheduleWeekday[] | undefined,
  })
  if (standing) {
    return { schedule: standing, already: true as const }
  }
  const schedule = createSchedule(store, {
    botId,
    personId,
    cadence: cadence as ScheduleCadence,
    timeLocal: String(input.timeLocal ?? ''),
    daysOfWeek: readDays(input) as ScheduleWeekday[] | undefined,
    wakeText: String(input.wakeText ?? ''),
  })
  return { schedule }
}

export function schedulesUpdate(
  store: OpenedStore,
  input: Record<string, unknown>,
  viewer?: BotViewer,
  ctx?: ScheduleToolContext,
) {
  const schedule = requireManagedSchedule(store, String(input.id ?? ''), viewer, ctx)
  const days = readDays(input)
  return {
    schedule: updateSchedule(store, schedule.id, {
      cadence: typeof input.cadence === 'string' ? input.cadence as ScheduleCadence : undefined,
      timeLocal: typeof input.timeLocal === 'string' ? input.timeLocal : undefined,
      daysOfWeek: days as ScheduleWeekday[] | undefined,
      wakeText: typeof input.wakeText === 'string' ? input.wakeText : undefined,
    }),
  }
}

export function schedulesPause(
  store: OpenedStore,
  input: Record<string, unknown>,
  viewer?: BotViewer,
  ctx?: ScheduleToolContext,
) {
  const schedule = requireManagedSchedule(store, String(input.id ?? ''), viewer, ctx)
  return { schedule: pauseSchedule(store, schedule.id) }
}

export function schedulesResume(
  store: OpenedStore,
  input: Record<string, unknown>,
  viewer?: BotViewer,
  ctx?: ScheduleToolContext,
) {
  const schedule = requireManagedSchedule(store, String(input.id ?? ''), viewer, ctx)
  return { schedule: resumeSchedule(store, schedule.id) }
}

export function schedulesDelete(
  store: OpenedStore,
  input: Record<string, unknown>,
  viewer?: BotViewer,
  ctx?: ScheduleToolContext,
) {
  const schedule = requireManagedSchedule(store, String(input.id ?? ''), viewer, ctx)
  deleteSchedule(store, schedule.id)
  return { ok: true as const, schedule }
}

function requireSheetSchedule(store: OpenedStore, id: string, viewer: BotViewer): Schedule {
  const schedule = getSchedule(store, id)
  if (!schedule || !actorMayManage(schedule.personId, viewer)) {
    throw new StoreError('This Schedule is gone', 404)
  }
  assertMemberCanSeeBot(store, schedule.botId, viewer)
  return schedule
}

/** Sheet id `schedule`. One row. A missing row says the Schedule is gone. */
export function scheduleSheetRead(store: OpenedStore, id: string, viewer: BotViewer) {
  return { schedule: requireSheetSchedule(store, id, viewer) }
}

export function scheduleSheetSave(
  store: OpenedStore,
  id: string,
  input: {
    cadence?: string
    timeLocal?: string
    daysOfWeek?: string[]
    wakeText?: string
    paused?: boolean
  },
  viewer: BotViewer,
) {
  const current = requireSheetSchedule(store, id, viewer)
  const hasFields = input.cadence !== undefined
    || input.timeLocal !== undefined
    || input.daysOfWeek !== undefined
    || input.wakeText !== undefined
  let schedule = current
  if (hasFields) {
    schedule = updateSchedule(store, current.id, {
      cadence: input.cadence as ScheduleCadence | undefined,
      timeLocal: input.timeLocal,
      daysOfWeek: input.daysOfWeek as ScheduleWeekday[] | undefined,
      wakeText: input.wakeText,
    })
  }
  if (input.paused === true) {
    schedule = pauseSchedule(store, schedule.id)
  } else if (input.paused === false) {
    schedule = resumeSchedule(store, schedule.id)
  }
  return { schedule }
}

export function scheduleSheetDelete(store: OpenedStore, id: string, viewer: BotViewer) {
  const schedule = requireSheetSchedule(store, id, viewer)
  deleteSchedule(store, schedule.id)
  return { ok: true as const }
}

export function clusterTimezoneGet(store: OpenedStore, env: NodeJS.ProcessEnv = process.env) {
  return effectiveClusterTimeZone(store, env)
}

export function clusterTimezoneSet(
  store: OpenedStore,
  input: Record<string, unknown>,
  viewer?: BotViewer,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (viewer && viewer.role !== 'owner') {
    throw new StoreError('Only the Owner can change this', 403)
  }
  const timezone = typeof input.timezone === 'string' ? input.timezone : ''
  return setClusterTimeZone(store, timezone, { env })
}
