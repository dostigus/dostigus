import { expect, it } from 'vitest'
import { scheduleErrorField } from '../../app/utils/schedule-form'

it('puts Schedule Store errors under the field they name', () => {
  expect(scheduleErrorField({ data: { statusMessage: 'Name must be 80 characters or fewer' } })).toBe('name')
  expect(scheduleErrorField({ statusMessage: 'cadence must be daily or weekly' })).toBe('cadence')
  expect(scheduleErrorField({ statusMessage: 'timeLocal must be HH:MM' })).toBe('time')
  expect(scheduleErrorField({ statusMessage: 'Name the weekdays (sun, mon, tue, wed, thu, fri, sat)' })).toBe('days')
  expect(scheduleErrorField({ statusMessage: 'daysOfWeek uses sun, mon, tue, wed, thu, fri, sat' })).toBe('days')
  expect(scheduleErrorField({ statusMessage: 'Wake text is required' })).toBe('wakeText')
  expect(scheduleErrorField({ statusMessage: 'Wake text must be 2000 characters or fewer' })).toBe('wakeText')
})

it('keeps errors that name no single field at the form', () => {
  expect(scheduleErrorField({ statusMessage: 'Bot not found' })).toBe('form')
  expect(scheduleErrorField({ statusMessage: 'Name the person for this Schedule' })).toBe('form')
  expect(scheduleErrorField(new Error('network'))).toBe('form')
  expect(scheduleErrorField(undefined)).toBe('form')
})
