import { expect, it } from 'vitest'
import {
  scheduleCadenceLabel,
  scheduleDisplayName,
  scheduleRunOutcome,
  scheduleWhenLabel,
  truncateScheduleText,
} from '../../app/utils/schedule-copy'

it('falls back to truncated wakeText when name is empty', () => {
  expect(scheduleDisplayName({ name: '', wakeText: 'Morning briefing' })).toBe('Morning briefing')
  expect(scheduleDisplayName({ name: '  Утро  ', wakeText: 'Wake' })).toBe('Утро')
  expect(truncateScheduleText('abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ')).toBe(
    'abcdefghijklmnopqrstuvwxyz0123456789ABCDE…',
  )
})

it('names daily and weekly cadence in the Locale dictionary', () => {
  expect(scheduleCadenceLabel({
    cadence: 'daily',
    timeLocal: '08:00',
  }, 'ru')).toBe('каждый день · 08:00')
  expect(scheduleCadenceLabel({
    cadence: 'weekly',
    timeLocal: '09:21',
    daysOfWeek: ['mon', 'wed'],
  }, 'ru')).toBe('каждую неделю · пн, ср · 09:21')
  expect(scheduleCadenceLabel({
    cadence: 'daily',
    timeLocal: '08:00',
  })).toBe('every day · 08:00')
})

it('labels wake history in the Cluster timezone', () => {
  const tz = 'UTC'
  const now = Date.parse('2026-09-24T12:00:00.000Z')
  expect(scheduleWhenLabel('2026-09-24T08:15:00.000Z', tz, now, 'ru')).toBe('Сегодня в 08:15')
  expect(scheduleWhenLabel('2026-09-23T08:12:00.000Z', tz, now, 'ru')).toBe('Вчера в 08:12')
  expect(scheduleWhenLabel('2026-09-25T08:02:00.000Z', tz, now, 'ru')).toBe('Завтра в 08:02')
  expect(scheduleWhenLabel('2026-09-15T08:08:00.000Z', tz, now, 'ru')).toBe('15 сентября в 08:08')
  expect(scheduleWhenLabel('2026-09-24T08:15:00.000Z', tz, now)).toBe('Today at 08:15')
  expect(scheduleRunOutcome('ok', 'ru')).toBe('Успешно')
  expect(scheduleRunOutcome('error', 'ru')).toBe('Ошибка')
  expect(scheduleRunOutcome('ok')).toBe('Succeeded')
})
