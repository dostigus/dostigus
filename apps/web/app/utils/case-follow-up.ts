/** `YYYY-MM-DDTHH:MM` for a `datetime-local` input, read in the Cluster timezone. */
export function followUpInputValue(iso: string, timeZone: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) {
    return ''
  }
  return wallClock(ms, timeZone)
}

/** Tomorrow at 09:00 in the Cluster timezone, as a `datetime-local` value. */
export function defaultFollowUpInput(now: number, timeZone: string): string {
  const [date] = wallClock(now, timeZone).split('T')
  const [year, month, day] = (date ?? '').split('-').map(Number)
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + 1))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}T09:00`
}

function wallClock(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}
