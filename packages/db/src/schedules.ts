import type { BotViewer } from '@dostigus/shared'
import type {
  ScheduleCadence,
  ScheduleWeekday,
} from './schedule-time'
import type { OpenedStore } from './store'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { getMember } from './members'
import { getOwner } from './owners'
import { getBot, StoreError, viewerMaySeeBot } from './queries'
import {
  isScheduleWeekday,
  isValidIanaTimeZone,
  nextScheduleRunAt,
  SCHEDULE_DEFER_MS,
  SCHEDULE_WEEKDAYS,
} from './schedule-time'

const CLUSTER_SETTINGS_ID = 'cluster'
const WAKE_TEXT_MAX = 2_000

const SCHEDULE_COLUMNS = `
  id, bot_id, person_id, cadence, time_local, days_of_week_json, wake_text,
  paused, next_run_at, last_run_at, last_run_status, defer_count, created_at, updated_at
`

export type ScheduleLastRunStatus = 'fired' | 'skipped_late' | 'skipped_busy' | 'deferred'

export type Schedule = {
  id: string
  botId: string
  personId: string
  cadence: ScheduleCadence
  timeLocal: string
  daysOfWeek: ScheduleWeekday[] | null
  wakeText: string
  paused: boolean
  nextRunAt: string
  lastRunAt: string | null
  lastRunStatus: ScheduleLastRunStatus | null
  createdAt: string
  updatedAt: string
}

export type DueSchedule = Schedule & {
  deferCount: number
  plannedAt: number
}

export type ClusterTimeZone = {
  stored: string | null
  effective: string
  source: 'store' | 'env' | 'utc'
}

export type ScheduleClock = {
  now?: number
  env?: NodeJS.ProcessEnv
}

type ScheduleRow = {
  id: string
  bot_id: string
  person_id: string
  cadence: string
  time_local: string
  days_of_week_json: string | null
  wake_text: string
  paused: number
  next_run_at: number
  last_run_at: number | null
  last_run_status: string | null
  defer_count: number
  created_at: number
  updated_at: number
}

export type ScheduleWrite = {
  botId: string
  personId: string
  cadence: ScheduleCadence
  timeLocal: string
  daysOfWeek?: ScheduleWeekday[] | null
  wakeText: string
}

function clockNow(clock?: ScheduleClock): number {
  return clock?.now ?? Date.now()
}

function clockEnv(clock?: ScheduleClock): NodeJS.ProcessEnv {
  return clock?.env ?? process.env
}

function assertClusterPerson(store: OpenedStore, personId: string): string {
  const id = personId.trim()
  if (!id) {
    throw new StoreError('Name the person for this Schedule', 400)
  }
  if (getOwner(store, id) || getMember(store, id)) {
    return id
  }
  throw new StoreError('That person is not on this Cluster', 400)
}

export function viewerForPerson(store: OpenedStore, personId: string): BotViewer {
  if (getOwner(store, personId)) {
    return { id: personId, role: 'owner' }
  }
  return { id: personId, role: 'member' }
}

export function personMayOpenBot(store: OpenedStore, botId: string, personId: string): boolean {
  const bot = getBot(store, botId)
  if (!bot) {
    return false
  }
  return viewerMaySeeBot(store, bot, viewerForPerson(store, personId))
}

export function normalizeTimeLocal(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) {
    throw new StoreError('timeLocal must be HH:MM', 400)
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) {
    throw new StoreError('timeLocal must be HH:MM', 400)
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function normalizeWeekdays(value: readonly string[] | null | undefined): ScheduleWeekday[] {
  if (!value || value.length === 0) {
    throw new StoreError(`Name the weekdays (${SCHEDULE_WEEKDAYS.join(', ')})`, 400)
  }
  const days: ScheduleWeekday[] = []
  for (const item of value) {
    const token = item.trim().toLowerCase()
    if (!isScheduleWeekday(token)) {
      throw new StoreError(`daysOfWeek uses ${SCHEDULE_WEEKDAYS.join(', ')}`, 400)
    }
    if (!days.includes(token)) {
      days.push(token)
    }
  }
  days.sort((a, b) => SCHEDULE_WEEKDAYS.indexOf(a) - SCHEDULE_WEEKDAYS.indexOf(b))
  return days
}

function normalizeWakeText(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new StoreError('Wake text is required', 400)
  }
  if (trimmed.length > WAKE_TEXT_MAX) {
    throw new StoreError(`Wake text must be ${WAKE_TEXT_MAX} characters or fewer`, 400)
  }
  return trimmed
}

function normalizeCadence(value: string): ScheduleCadence {
  if (value === 'daily' || value === 'weekly') {
    return value
  }
  throw new StoreError('cadence must be daily or weekly', 400)
}

function daysJson(days: ScheduleWeekday[] | null): string | null {
  return days ? JSON.stringify(days) : null
}

function parseDays(raw: string | null): ScheduleWeekday[] | null {
  if (!raw) {
    return null
  }
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) {
      return null
    }
    return value.filter((item): item is ScheduleWeekday => isScheduleWeekday(item))
  } catch {
    return null
  }
}

function isLastRunStatus(value: string | null): value is ScheduleLastRunStatus | null {
  return value === null
    || value === 'fired'
    || value === 'skipped_late'
    || value === 'skipped_busy'
    || value === 'deferred'
}

function toSchedule(row: ScheduleRow): Schedule {
  const cadence = row.cadence === 'weekly' ? 'weekly' : 'daily'
  return {
    id: row.id,
    botId: row.bot_id,
    personId: row.person_id,
    cadence,
    timeLocal: row.time_local,
    daysOfWeek: cadence === 'weekly' ? parseDays(row.days_of_week_json) : null,
    wakeText: row.wake_text,
    paused: row.paused !== 0,
    nextRunAt: new Date(row.next_run_at).toISOString(),
    lastRunAt: row.last_run_at == null ? null : new Date(row.last_run_at).toISOString(),
    lastRunStatus: isLastRunStatus(row.last_run_status) ? row.last_run_status : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function toDue(row: ScheduleRow): DueSchedule {
  return {
    ...toSchedule(row),
    deferCount: row.defer_count,
    plannedAt: row.next_run_at,
  }
}

function selectSchedule(store: OpenedStore, id: string): ScheduleRow | undefined {
  return store.sqlite.prepare(`
    SELECT ${SCHEDULE_COLUMNS}
    FROM schedules
    WHERE id = ?
  `).get(id) as ScheduleRow | undefined
}

export function getSchedule(store: OpenedStore, id: string): Schedule | undefined {
  const row = selectSchedule(store, id)
  return row ? toSchedule(row) : undefined
}

export function requireSchedule(store: OpenedStore, id: string): ScheduleRow {
  const row = selectSchedule(store, id)
  if (!row) {
    throw new StoreError('Schedule not found', 404)
  }
  return row
}

function readTimezoneRow(store: OpenedStore): { timezone: string | null } | undefined {
  return store.sqlite.prepare(`
    SELECT timezone FROM cluster_settings WHERE id = ?
  `).get(CLUSTER_SETTINGS_ID) as { timezone: string | null } | undefined
}

export function effectiveClusterTimeZone(
  store: OpenedStore,
  env: NodeJS.ProcessEnv = process.env,
): ClusterTimeZone {
  const storedRaw = readTimezoneRow(store)?.timezone?.trim() || null
  if (storedRaw && isValidIanaTimeZone(storedRaw)) {
    return { stored: storedRaw, effective: storedRaw, source: 'store' }
  }
  const fromEnv = env.DOSTIGUS_TZ?.trim() ?? ''
  if (fromEnv && isValidIanaTimeZone(fromEnv)) {
    return { stored: storedRaw, effective: fromEnv, source: 'env' }
  }
  return { stored: storedRaw, effective: 'UTC', source: 'utc' }
}

function nextRunFor(row: Pick<ScheduleRow, 'cadence' | 'time_local' | 'days_of_week_json'>, timeZone: string, afterMs: number): number {
  const cadence = normalizeCadence(row.cadence)
  try {
    return nextScheduleRunAt({
      cadence,
      timeLocal: row.time_local,
      daysOfWeek: cadence === 'weekly' ? parseDays(row.days_of_week_json) : null,
      timeZone,
      afterMs,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not compute the next Schedule run'
    throw new StoreError(message, 400)
  }
}

function resolvedDays(cadence: ScheduleCadence, days: ScheduleWeekday[] | null | undefined): ScheduleWeekday[] | null {
  if (cadence === 'daily') {
    if (days && days.length > 0) {
      throw new StoreError('daysOfWeek is omitted for a daily Schedule', 400)
    }
    return null
  }
  return normalizeWeekdays(days ?? undefined)
}

export function createSchedule(
  store: OpenedStore,
  input: ScheduleWrite,
  clock?: ScheduleClock,
): Schedule {
  const botId = input.botId.trim()
  if (!botId || !getBot(store, botId)) {
    throw new StoreError('Bot not found', 404)
  }
  const personId = assertClusterPerson(store, input.personId)
  const cadence = normalizeCadence(input.cadence)
  const timeLocal = normalizeTimeLocal(input.timeLocal)
  const days = resolvedDays(cadence, input.daysOfWeek)
  const wakeText = normalizeWakeText(input.wakeText)
  const now = clockNow(clock)
  const timeZone = effectiveClusterTimeZone(store, clockEnv(clock)).effective
  const nextRunAt = nextRunFor({
    cadence,
    time_local: timeLocal,
    days_of_week_json: daysJson(days),
  }, timeZone, now)
  const id = randomUUID()
  store.sqlite.prepare(`
    INSERT INTO schedules (
      id, bot_id, person_id, cadence, time_local, days_of_week_json, wake_text,
      paused, next_run_at, last_run_at, last_run_status, defer_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, 0, ?, ?)
  `).run(id, botId, personId, cadence, timeLocal, daysJson(days), wakeText, nextRunAt, now, now)
  return toSchedule(requireSchedule(store, id))
}

export function updateSchedule(
  store: OpenedStore,
  id: string,
  input: {
    cadence?: ScheduleCadence
    timeLocal?: string
    daysOfWeek?: ScheduleWeekday[] | null
    wakeText?: string
  },
  clock?: ScheduleClock,
): Schedule {
  const row = requireSchedule(store, id)
  const cadence = input.cadence ? normalizeCadence(input.cadence) : normalizeCadence(row.cadence)
  const timeLocal = input.timeLocal ? normalizeTimeLocal(input.timeLocal) : row.time_local
  const wakeText = input.wakeText !== undefined ? normalizeWakeText(input.wakeText) : row.wake_text
  let days: ScheduleWeekday[] | null
  if (cadence === 'daily') {
    if (input.daysOfWeek && input.daysOfWeek.length > 0) {
      throw new StoreError('daysOfWeek is omitted for a daily Schedule', 400)
    }
    days = null
  } else if (input.daysOfWeek) {
    days = normalizeWeekdays(input.daysOfWeek)
  } else {
    days = parseDays(row.days_of_week_json)
    if (!days || days.length === 0) {
      throw new StoreError(`Name the weekdays (${SCHEDULE_WEEKDAYS.join(', ')})`, 400)
    }
  }
  const now = clockNow(clock)
  const timeZone = effectiveClusterTimeZone(store, clockEnv(clock)).effective
  const nextRunAt = nextRunFor({
    cadence,
    time_local: timeLocal,
    days_of_week_json: daysJson(days),
  }, timeZone, now)
  store.sqlite.prepare(`
    UPDATE schedules SET
      cadence = ?,
      time_local = ?,
      days_of_week_json = ?,
      wake_text = ?,
      next_run_at = ?,
      defer_count = 0,
      updated_at = ?
    WHERE id = ?
  `).run(cadence, timeLocal, daysJson(days), wakeText, nextRunAt, now, row.id)
  return toSchedule(requireSchedule(store, row.id))
}

export function pauseSchedule(store: OpenedStore, id: string, clock?: ScheduleClock): Schedule {
  const row = requireSchedule(store, id)
  const now = clockNow(clock)
  store.sqlite.prepare(`
    UPDATE schedules SET paused = 1, updated_at = ? WHERE id = ?
  `).run(now, row.id)
  return toSchedule(requireSchedule(store, row.id))
}

export function resumeSchedule(store: OpenedStore, id: string, clock?: ScheduleClock): Schedule {
  const row = requireSchedule(store, id)
  const now = clockNow(clock)
  const timeZone = effectiveClusterTimeZone(store, clockEnv(clock)).effective
  const nextRunAt = nextRunFor(row, timeZone, now)
  store.sqlite.prepare(`
    UPDATE schedules SET
      paused = 0,
      next_run_at = ?,
      defer_count = 0,
      updated_at = ?
    WHERE id = ?
  `).run(nextRunAt, now, row.id)
  return toSchedule(requireSchedule(store, row.id))
}

export function deleteSchedule(store: OpenedStore, id: string): void {
  const row = requireSchedule(store, id)
  store.sqlite.prepare('DELETE FROM schedules WHERE id = ?').run(row.id)
}

/**
 * An enabled Schedule with the same cadence, local time, and weekdays.
 * A paused row is not already standing. See ADR 0030.
 */
export function findEnabledEquivalentSchedule(
  store: OpenedStore,
  input: {
    botId: string
    personId: string
    cadence: string
    timeLocal: string
    daysOfWeek?: ScheduleWeekday[] | null
  },
): Schedule | null {
  const cadence = normalizeCadence(input.cadence)
  const timeLocal = normalizeTimeLocal(input.timeLocal)
  const days = resolvedDays(cadence, input.daysOfWeek)
  const wanted = JSON.stringify(days ?? [])
  return listSchedules(store, { botId: input.botId, personId: input.personId }).find((row) => {
    if (row.paused || row.cadence !== cadence || row.timeLocal !== timeLocal) {
      return false
    }
    return JSON.stringify(row.daysOfWeek ?? []) === wanted
  }) ?? null
}

export function listSchedules(
  store: OpenedStore,
  filter: { botId: string, personId?: string },
): Schedule[] {
  const botId = filter.botId.trim()
  if (!botId || !getBot(store, botId)) {
    throw new StoreError('Bot not found', 404)
  }
  const personId = filter.personId?.trim()
  const rows = personId
    ? store.sqlite.prepare(`
        SELECT ${SCHEDULE_COLUMNS}
        FROM schedules
        WHERE bot_id = ? AND person_id = ?
        ORDER BY created_at ASC, id ASC
      `).all(botId, personId) as ScheduleRow[]
    : store.sqlite.prepare(`
        SELECT ${SCHEDULE_COLUMNS}
        FROM schedules
        WHERE bot_id = ?
        ORDER BY created_at ASC, id ASC
      `).all(botId) as ScheduleRow[]
  return rows.map(toSchedule)
}

export function listDueSchedules(store: OpenedStore, now: number): DueSchedule[] {
  const rows = store.sqlite.prepare(`
    SELECT ${SCHEDULE_COLUMNS}
    FROM schedules
    WHERE paused = 0 AND next_run_at <= ?
    ORDER BY next_run_at ASC, id ASC
  `).all(now) as ScheduleRow[]
  return rows.map(toDue)
}

export function recordScheduleDefer(store: OpenedStore, id: string, now: number): Schedule {
  const row = requireSchedule(store, id)
  store.sqlite.prepare(`
    UPDATE schedules SET
      next_run_at = ?,
      last_run_at = ?,
      last_run_status = 'deferred',
      defer_count = ?,
      updated_at = ?
    WHERE id = ?
  `).run(now + SCHEDULE_DEFER_MS, now, row.defer_count + 1, now, row.id)
  return toSchedule(requireSchedule(store, row.id))
}

export function recordScheduleSkip(
  store: OpenedStore,
  id: string,
  status: 'skipped_late' | 'skipped_busy',
  clock?: ScheduleClock,
): Schedule {
  const row = requireSchedule(store, id)
  const now = clockNow(clock)
  const timeZone = effectiveClusterTimeZone(store, clockEnv(clock)).effective
  const nextRunAt = nextRunFor(row, timeZone, now)
  store.sqlite.prepare(`
    UPDATE schedules SET
      next_run_at = ?,
      last_run_at = ?,
      last_run_status = ?,
      defer_count = 0,
      updated_at = ?
    WHERE id = ?
  `).run(nextRunAt, now, status, now, row.id)
  return toSchedule(requireSchedule(store, row.id))
}

export function recordScheduleFire(store: OpenedStore, id: string, clock?: ScheduleClock): Schedule {
  const row = requireSchedule(store, id)
  const now = clockNow(clock)
  const timeZone = effectiveClusterTimeZone(store, clockEnv(clock)).effective
  const nextRunAt = nextRunFor(row, timeZone, now)
  store.sqlite.prepare(`
    UPDATE schedules SET
      next_run_at = ?,
      last_run_at = ?,
      last_run_status = 'fired',
      defer_count = 0,
      updated_at = ?
    WHERE id = ?
  `).run(nextRunAt, now, now, row.id)
  return toSchedule(requireSchedule(store, row.id))
}

export function setClusterTimeZone(
  store: OpenedStore,
  timezone: string,
  clock?: ScheduleClock,
): ClusterTimeZone {
  const name = timezone.trim()
  if (!isValidIanaTimeZone(name)) {
    throw new StoreError('Cluster timezone must be an IANA name', 400)
  }
  const now = clockNow(clock)
  const env = clockEnv(clock)
  store.sqlite.exec('BEGIN')
  try {
    store.sqlite.prepare(`
      INSERT INTO cluster_settings (id, timezone, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        timezone = excluded.timezone,
        updated_at = excluded.updated_at
    `).run(CLUSTER_SETTINGS_ID, name, now)
    const timeZone = effectiveClusterTimeZone(store, env).effective
    const rows = store.sqlite.prepare(`
      SELECT ${SCHEDULE_COLUMNS} FROM schedules
    `).all() as ScheduleRow[]
    const update = store.sqlite.prepare(`
      UPDATE schedules SET next_run_at = ?, defer_count = 0, updated_at = ? WHERE id = ?
    `)
    for (const row of rows) {
      update.run(nextRunFor(row, timeZone, now), now, row.id)
    }
    store.sqlite.exec('COMMIT')
  } catch (error) {
    store.sqlite.exec('ROLLBACK')
    throw error
  }
  return effectiveClusterTimeZone(store, env)
}
