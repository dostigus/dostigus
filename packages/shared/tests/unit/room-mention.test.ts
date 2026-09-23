import { expect, it } from 'vitest'
import { mentionedRoomBot } from '../../src/index'

const expi = { id: 'expi', name: 'Expi' }
const notes = { id: 'notes', name: 'New Bot' }
const longer = { id: 'long', name: 'Expi Notes' }

it('matches @Name at the start or after a space', () => {
  expect(mentionedRoomBot('@Expi hello', [expi])?.id).toBe('expi')
  expect(mentionedRoomBot('hey @Expi hello', [expi])?.id).toBe('expi')
  expect(mentionedRoomBot('@expi', [expi])?.id).toBe('expi')
  expect(mentionedRoomBot('@Expi.', [expi])?.id).toBe('expi')
})

it('ignores a name that is not a mention', () => {
  expect(mentionedRoomBot('Expi hello', [expi])).toBeNull()
  expect(mentionedRoomBot('email@Expi', [expi])).toBeNull()
  expect(mentionedRoomBot('@ExpiExtra', [expi])).toBeNull()
  expect(mentionedRoomBot('no bots here', [expi])).toBeNull()
})

it('picks the earliest mention, and the longer name at the same @', () => {
  expect(mentionedRoomBot('@New Bot then @Expi', [expi, notes])?.id).toBe('notes')
  expect(mentionedRoomBot('@Expi Notes please', [expi, longer])?.id).toBe('long')
  expect(mentionedRoomBot('@Expi please', [expi, longer])?.id).toBe('expi')
})
