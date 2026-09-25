import type { HostLocale } from '@dostigus/ui-kit/locale'
import { DEFAULT_HOST_LOCALE, tHost } from '@dostigus/ui-kit/locale'

export const SCHEDULE_NAME_MAX = 80
export const SCHEDULE_WAKE_MAX = 2_000
export const SCHEDULE_TITLE_FALLBACK_MAX = 42

export const SCHEDULE_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type ScheduleWeekday = typeof SCHEDULE_WEEKDAYS[number]

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function scheduleWeekdayLabels(locale: HostLocale = DEFAULT_HOST_LOCALE): Record<ScheduleWeekday, string> {
  return {
    sun: tHost(locale, 'schedule.weekday.sun'),
    mon: tHost(locale, 'schedule.weekday.mon'),
    tue: tHost(locale, 'schedule.weekday.tue'),
    wed: tHost(locale, 'schedule.weekday.wed'),
    thu: tHost(locale, 'schedule.weekday.thu'),
    fri: tHost(locale, 'schedule.weekday.fri'),
    sat: tHost(locale, 'schedule.weekday.sat'),
  }
}

export const SCHEDULE_WEEKDAY_LABELS = scheduleWeekdayLabels('ru')

const WEEKDAY_EN: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function truncateScheduleText(value: string, max = SCHEDULE_TITLE_FALLBACK_MAX): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) {
    return trimmed
  }
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export function scheduleDisplayName(schedule: { name?: string | null, wakeText: string }): string {
  const name = schedule.name?.trim() ?? ''
  return name || truncateScheduleText(schedule.wakeText)
}

export function scheduleCadenceLabel(schedule: {
  cadence: 'daily' | 'weekly'
  timeLocal: string
  daysOfWeek?: string[] | null
}, locale: HostLocale = DEFAULT_HOST_LOCALE): string {
  if (schedule.cadence === 'daily') {
    return tHost(locale, 'schedule.cadenceDaily', { time: schedule.timeLocal })
  }
  const labels = scheduleWeekdayLabels(locale)
  const days = (schedule.daysOfWeek ?? [])
    .filter((day): day is ScheduleWeekday => day in labels)
    .map((day) => labels[day])
    .join(', ')
  return days
    ? tHost(locale, 'schedule.cadenceWeekly', { days, time: schedule.timeLocal })
    : tHost(locale, 'schedule.cadenceWeeklyNoDays', { time: schedule.timeLocal })
}

export function scheduleRunOutcome(outcome: string, locale: HostLocale = DEFAULT_HOST_LOCALE): string {
  if (outcome === 'ok' || outcome === 'error' || outcome === 'abort' || outcome === 'running') {
    return tHost(locale, `schedule.outcome.${outcome}`)
  }
  return outcome
}

export function scheduleWhenLabel(
  iso: string,
  timeZone: string,
  now = Date.now(),
  locale: HostLocale = DEFAULT_HOST_LOCALE,
): string {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) {
    return ''
  }
  const here = zonedParts(at, timeZone)
  const today = zonedParts(now, timeZone)
  const delta = here.dayIndex - today.dayIndex
  const time = `${here.hh}:${here.mm}`
  if (delta === 0) {
    return tHost(locale, 'schedule.when.today', { time })
  }
  if (delta === -1) {
    return tHost(locale, 'schedule.when.yesterday', { time })
  }
  if (delta === 1) {
    return tHost(locale, 'schedule.when.tomorrow', { time })
  }
  const weekdayKey = WEEKDAY_KEYS[here.weekday]
  if (delta >= -6 && delta <= 6 && weekdayKey) {
    return tHost(locale, 'schedule.when.weekday', {
      day: tHost(locale, `schedule.weekdayLong.${weekdayKey}`),
      time,
    })
  }
  return tHost(locale, 'schedule.when.date', {
    day: String(here.d),
    month: tHost(locale, `schedule.month.${here.m}`),
    time,
  })
}

function zonedParts(ms: number, timeZone: string): {
  y: number
  m: number
  d: number
  weekday: number
  hh: string
  mm: string
  dayIndex: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(new Date(ms))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour')
  const y = Number(get('year'))
  const m = Number(get('month'))
  const d = Number(get('day'))
  return {
    y,
    m,
    d,
    weekday: WEEKDAY_EN[get('weekday')] ?? 0,
    hh: hour.padStart(2, '0'),
    mm: get('minute').padStart(2, '0'),
    dayIndex: Date.UTC(y, m - 1, d) / 86_400_000,
  }
}
