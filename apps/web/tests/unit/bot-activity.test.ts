import { expect, it } from 'vitest'
import { botIsLive } from '../../app/utils/bot-activity'

const quiet = { pending: false, replying: false, cheering: false, failed: false }

it('marks a Bot live only while it is busy', () => {
  expect(botIsLive(quiet)).toBe(false)
  expect(botIsLive({ ...quiet, pending: true })).toBe(true)
  expect(botIsLive({ ...quiet, replying: true })).toBe(true)
  expect(botIsLive({ ...quiet, cheering: true })).toBe(true)
  expect(botIsLive({ ...quiet, failed: true })).toBe(true)
})
