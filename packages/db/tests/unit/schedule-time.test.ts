import { expect, it } from 'vitest'
import {
  decideScheduleFire,
  isValidIanaTimeZone,
  nextScheduleRunAt,
  SCHEDULE_CATCH_UP_MS,
  SCHEDULE_DEFER_LIMIT,
} from '../../src/index'

it('accepts IANA names and rejects offsets and abbreviations', () => {
  expect(isValidIanaTimeZone('UTC')).toBe(true)
  expect(isValidIanaTimeZone('America/New_York')).toBe(true)
  expect(isValidIanaTimeZone('Europe/Kyiv')).toBe(true)
  expect(isValidIanaTimeZone('EST')).toBe(false)
  expect(isValidIanaTimeZone('GMT+5')).toBe(false)
  expect(isValidIanaTimeZone('Not/AZone')).toBe(false)
  expect(isValidIanaTimeZone('')).toBe(false)
})

it('schedules the next daily and weekly wall clock in UTC', () => {
  const sundayMorning = Date.parse('2026-01-11T09:00:00.000Z')
  expect(nextScheduleRunAt({
    cadence: 'daily',
    timeLocal: '08:00',
    daysOfWeek: null,
    timeZone: 'UTC',
    afterMs: Date.parse('2026-01-15T07:00:00.000Z'),
  })).toBe(Date.parse('2026-01-15T08:00:00.000Z'))
  expect(nextScheduleRunAt({
    cadence: 'daily',
    timeLocal: '08:00',
    daysOfWeek: null,
    timeZone: 'UTC',
    afterMs: Date.parse('2026-01-15T08:00:00.000Z'),
  })).toBe(Date.parse('2026-01-16T08:00:00.000Z'))
  expect(nextScheduleRunAt({
    cadence: 'weekly',
    timeLocal: '08:00',
    daysOfWeek: ['mon', 'wed'],
    timeZone: 'UTC',
    afterMs: sundayMorning,
  })).toBe(Date.parse('2026-01-12T08:00:00.000Z'))
  expect(nextScheduleRunAt({
    cadence: 'weekly',
    timeLocal: '08:00',
    daysOfWeek: ['mon', 'wed'],
    timeZone: 'UTC',
    afterMs: Date.parse('2026-01-12T08:00:00.000Z'),
  })).toBe(Date.parse('2026-01-14T08:00:00.000Z'))
})

it('moves a daily 08:00 across America/New_York DST', () => {
  expect(nextScheduleRunAt({
    cadence: 'daily',
    timeLocal: '08:00',
    daysOfWeek: null,
    timeZone: 'America/New_York',
    afterMs: Date.parse('2026-03-07T12:00:00.000Z'),
  })).toBe(Date.parse('2026-03-07T13:00:00.000Z'))
  expect(nextScheduleRunAt({
    cadence: 'daily',
    timeLocal: '08:00',
    daysOfWeek: null,
    timeZone: 'America/New_York',
    afterMs: Date.parse('2026-03-07T13:00:00.000Z'),
  })).toBe(Date.parse('2026-03-08T12:00:00.000Z'))
  expect(nextScheduleRunAt({
    cadence: 'daily',
    timeLocal: '08:00',
    daysOfWeek: null,
    timeZone: 'America/New_York',
    afterMs: Date.parse('2026-03-08T12:00:00.000Z'),
  })).toBe(Date.parse('2026-03-09T12:00:00.000Z'))
})

it('places a missing spring-forward minute on the first valid minute', () => {
  expect(nextScheduleRunAt({
    cadence: 'daily',
    timeLocal: '02:30',
    daysOfWeek: null,
    timeZone: 'America/New_York',
    afterMs: Date.parse('2026-03-08T06:00:00.000Z'),
  })).toBe(Date.parse('2026-03-08T07:00:00.000Z'))
})

it('uses the earlier instant when a fall-back hour repeats', () => {
  expect(nextScheduleRunAt({
    cadence: 'daily',
    timeLocal: '01:30',
    daysOfWeek: null,
    timeZone: 'America/New_York',
    afterMs: Date.parse('2026-10-31T06:00:00.000Z'),
  })).toBe(Date.parse('2026-11-01T05:30:00.000Z'))
})

it('fires inside the catch-up window, defers while busy, and skips after five defers', () => {
  const now = 1_000_000
  expect(decideScheduleFire({
    now,
    plannedAt: now - SCHEDULE_CATCH_UP_MS + 1,
    deferCount: 0,
    hasAccess: true,
    busy: false,
  })).toBe('fire')
  expect(decideScheduleFire({
    now,
    plannedAt: now - SCHEDULE_CATCH_UP_MS,
    deferCount: 0,
    hasAccess: true,
    busy: false,
  })).toBe('skip_late')
  expect(decideScheduleFire({
    now,
    plannedAt: now,
    deferCount: 0,
    hasAccess: false,
    busy: false,
  })).toBe('wait_access')
  expect(decideScheduleFire({
    now,
    plannedAt: now - SCHEDULE_CATCH_UP_MS,
    deferCount: 0,
    hasAccess: false,
    busy: true,
  })).toBe('skip_late')
  expect(decideScheduleFire({
    now,
    plannedAt: now,
    deferCount: SCHEDULE_DEFER_LIMIT - 1,
    hasAccess: true,
    busy: true,
  })).toBe('defer')
  expect(decideScheduleFire({
    now,
    plannedAt: now,
    deferCount: SCHEDULE_DEFER_LIMIT,
    hasAccess: true,
    busy: true,
  })).toBe('skip_busy')
})
