import { expect, it } from 'vitest'
import { defaultFollowUpInput, followUpInputValue } from '../../app/utils/case-follow-up'

it('reads a follow-up instant as a wall clock in the Cluster timezone', () => {
  expect(followUpInputValue('2026-10-02T07:00:00.000Z', 'Europe/Berlin')).toBe('2026-10-02T09:00')
  expect(followUpInputValue('2026-10-02T07:00:00.000Z', 'UTC')).toBe('2026-10-02T07:00')
  expect(followUpInputValue('nope', 'UTC')).toBe('')
})

it('defaults to tomorrow at 09:00 in the Cluster timezone', () => {
  const now = Date.parse('2026-10-31T23:30:00.000Z')
  expect(defaultFollowUpInput(now, 'UTC')).toBe('2026-11-01T09:00')
  expect(defaultFollowUpInput(now, 'Europe/Berlin')).toBe('2026-11-02T09:00')
})
