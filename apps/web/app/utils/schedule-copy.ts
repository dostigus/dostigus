export const SCHEDULE_NAME_MAX = 80
export const SCHEDULE_WAKE_MAX = 2_000
export const SCHEDULE_TITLE_FALLBACK_MAX = 42

export const SCHEDULE_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type ScheduleWeekday = typeof SCHEDULE_WEEKDAYS[number]

export const SCHEDULE_WEEKDAY_LABELS: Record<ScheduleWeekday, string> = {
  sun: 'вс',
  mon: 'пн',
  tue: 'вт',
  wed: 'ср',
  thu: 'чт',
  fri: 'пт',
  sat: 'сб',
}

const WEEKDAY_IN_RU = [
  'В воскресенье',
  'В понедельник',
  'Во вторник',
  'В среду',
  'В четверг',
  'В пятницу',
  'В субботу',
] as const

const MONTHS_RU = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const

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
}): string {
  if (schedule.cadence === 'daily') {
    return `каждый день · ${schedule.timeLocal}`
  }
  const days = (schedule.daysOfWeek ?? [])
    .filter((day): day is ScheduleWeekday => day in SCHEDULE_WEEKDAY_LABELS)
    .map((day) => SCHEDULE_WEEKDAY_LABELS[day])
    .join(', ')
  return days
    ? `каждую неделю · ${days} · ${schedule.timeLocal}`
    : `каждую неделю · ${schedule.timeLocal}`
}

export function scheduleRunOutcome(outcome: string): string {
  if (outcome === 'ok') {
    return 'Успешно'
  }
  if (outcome === 'error') {
    return 'Ошибка'
  }
  if (outcome === 'abort') {
    return 'Прервано'
  }
  if (outcome === 'running') {
    return 'Идёт'
  }
  return outcome
}

export function scheduleWhenLabel(iso: string, timeZone: string, now = Date.now()): string {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) {
    return ''
  }
  const here = zonedParts(at, timeZone)
  const today = zonedParts(now, timeZone)
  const delta = here.dayIndex - today.dayIndex
  const time = `${here.hh}:${here.mm}`
  if (delta === 0) {
    return `Сегодня в ${time}`
  }
  if (delta === -1) {
    return `Вчера в ${time}`
  }
  if (delta === 1) {
    return `Завтра в ${time}`
  }
  if (delta >= -6 && delta <= 6) {
    return `${WEEKDAY_IN_RU[here.weekday] ?? 'В этот день'} в ${time}`
  }
  return `${here.d} ${MONTHS_RU[here.m - 1] ?? ''} в ${time}`
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
