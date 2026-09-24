import type { OpenedStore, ScheduleCadence, ScheduleWeekday } from '@dostigus/db'
import type { BotViewer } from '@dostigus/shared'
import process from 'node:process'
import {
  createSchedule,
  deleteSchedule,
  effectiveClusterTimeZone,
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
  if (viewer?.role === 'member') {
    if (requested && requested !== viewer.id) {
      throw new StoreError('Schedule not found', 404)
    }
    return { schedules: listSchedules(store, { botId, personId: viewer.id }) }
  }
  return {
    schedules: listSchedules(store, {
      botId,
      personId: requested || undefined,
    }),
  }
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
