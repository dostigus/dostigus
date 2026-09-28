import { hostStatusMessage } from './host-status-copy'

export type ScheduleFormField = 'name' | 'cadence' | 'time' | 'days' | 'wakeText' | 'form'

const FIELD_BY_MESSAGE: Array<[RegExp, ScheduleFormField]> = [
  [/^Name must be/, 'name'],
  [/^cadence /, 'cadence'],
  [/^timeLocal /, 'time'],
  [/^Name the weekdays|^daysOfWeek /, 'days'],
  [/^Wake text /, 'wakeText'],
]

/** The Schedule field a Store error sits under. `form` when it names no single field. */
export function scheduleErrorField(error: unknown): ScheduleFormField {
  const message = hostStatusMessage(error)
  return FIELD_BY_MESSAGE.find(([pattern]) => pattern.test(message))?.[1] ?? 'form'
}
