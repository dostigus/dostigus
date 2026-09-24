/**
 * Wall-clock Schedules in one IANA timezone. See ADR 0027.
 * A spring-forward gap uses the first valid minute at or after that
 * wall clock. A fall-back overlap uses the earlier instant.
 */

export const SCHEDULE_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export type ScheduleWeekday = typeof SCHEDULE_WEEKDAYS[number]

export type ScheduleCadence = 'daily' | 'weekly'

export const SCHEDULE_CATCH_UP_MS = 30 * 60 * 1000

export const SCHEDULE_DEFER_MS = 60 * 1000

export const SCHEDULE_DEFER_LIMIT = 5

export const SCHEDULE_TICK_MS = 30 * 1000

const WEEKDAY_INDEX: Record<ScheduleWeekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

const IANA_NAME = /^(?:UTC|[A-Za-z_]+(?:\/[\w+-]+)+)$/

export type ScheduleFireDecision = 'fire' | 'defer' | 'skip_late' | 'skip_busy' | 'wait_access'

type Civil = {
  year: number
  month: number
  day: number
}

type Wall = Civil & {
  hour: number
  minute: number
  second: number
}

export function isScheduleWeekday(value: unknown): value is ScheduleWeekday {
  return typeof value === 'string'
    && (SCHEDULE_WEEKDAYS as readonly string[]).includes(value)
}

export function isValidIanaTimeZone(value: string): boolean {
  const name = value.trim()
  if (!name || name.length > 64 || !IANA_NAME.test(name)) {
    return false
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone: name })
    return true
  } catch {
    return false
  }
}

/**
 * Catch-up fires when lateness is under 30 minutes. No access leaves the
 * row due. A busy bot-thread defers one minute, five times, then skips.
 */
export function decideScheduleFire(input: {
  now: number
  plannedAt: number
  deferCount: number
  hasAccess: boolean
  busy: boolean
}): ScheduleFireDecision {
  if (input.now - input.plannedAt >= SCHEDULE_CATCH_UP_MS) {
    return 'skip_late'
  }
  if (!input.hasAccess) {
    return 'wait_access'
  }
  if (input.busy) {
    return input.deferCount >= SCHEDULE_DEFER_LIMIT ? 'skip_busy' : 'defer'
  }
  return 'fire'
}

export function nextScheduleRunAt(input: {
  cadence: ScheduleCadence
  timeLocal: string
  daysOfWeek: ScheduleWeekday[] | null
  timeZone: string
  afterMs: number
}): number {
  const { hour, minute } = parseTimeLocal(input.timeLocal)
  const start = wallParts(input.afterMs, input.timeZone)
  const limit = input.cadence === 'weekly' ? 14 : 3
  for (let add = 0; add <= limit; add += 1) {
    const civil = addCivilDays(start, add)
    if (input.cadence === 'weekly') {
      const days = input.daysOfWeek ?? []
      const weekday = weekdayOfCivil(civil)
      if (!days.some((day) => WEEKDAY_INDEX[day] === weekday)) {
        continue
      }
    }
    const instant = zonedWallTimeToUtc(civil.year, civil.month, civil.day, hour, minute, input.timeZone)
    if (instant > input.afterMs) {
      return instant
    }
  }
  throw new Error('Could not compute the next Schedule run')
}

function parseTimeLocal(value: string): { hour: number, minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) {
    throw new Error('timeLocal must be HH:MM')
  }
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

function weekdayOfCivil(civil: Civil): number {
  return new Date(Date.UTC(civil.year, civil.month - 1, civil.day)).getUTCDay()
}

function addCivilDays(civil: Civil, days: number): Civil {
  const utc = new Date(Date.UTC(civil.year, civil.month - 1, civil.day + days))
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  }
}

function wallParts(utcMs: number, timeZone: string): Wall {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') {
      map[part.type] = part.value
    }
  }
  let hour = Number(map.hour)
  if (hour === 24) {
    hour = 0
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

function wallAsUtc(utcMs: number, timeZone: string): number {
  const wall = wallParts(utcMs, timeZone)
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
}

function matchesWall(
  utcMs: number,
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): boolean {
  const wall = wallParts(utcMs, timeZone)
  return wall.year === year
    && wall.month === month
    && wall.day === day
    && wall.hour === hour
    && wall.minute === minute
}

function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const instant1 = guess - (wallAsUtc(guess, timeZone) - guess)
  const instant2 = guess - (wallAsUtc(instant1, timeZone) - instant1)
  const matches = [instant1, instant2].filter((instant) =>
    matchesWall(instant, timeZone, year, month, day, hour, minute),
  )
  if (matches.length > 0) {
    return Math.min(...matches)
  }

  let cursor = Math.min(instant1, instant2)
  const limit = cursor + 3 * 60 * 60 * 1000
  while (cursor <= limit) {
    const wall = wallParts(cursor, timeZone)
    const onDay = wall.year === year && wall.month === month && wall.day === day
    const atOrAfter = wall.hour > hour || (wall.hour === hour && wall.minute >= minute)
    if (onDay && atOrAfter) {
      return cursor
    }
    cursor += 60_000
  }
  return instant2
}
