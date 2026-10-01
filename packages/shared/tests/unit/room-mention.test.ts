import { expect, it } from 'vitest'
import { insertRoomMention, mentionedRoomBot, roomMentionMatches, roomMentionQuery } from '../../src/index'

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

it('finds the @ token before the caret only at a word start', () => {
  expect(roomMentionQuery('@', 1)).toEqual({ at: 0, query: '' })
  expect(roomMentionQuery('hi @New B', 9)).toEqual({ at: 3, query: 'New B' })
  expect(roomMentionQuery('email@Expi', 10)).toBeNull()
  expect(roomMentionQuery('@Ex\npi', 6)).toBeNull()
  expect(roomMentionQuery('no mention', 10)).toBeNull()
})

it('filters room Bots by name prefix or word prefix', () => {
  const bots = [expi, notes, longer]
  expect(roomMentionMatches(bots, '').map((bot) => bot.id)).toEqual(['expi', 'notes', 'long'])
  expect(roomMentionMatches(bots, 'ex').map((bot) => bot.id)).toEqual(['expi', 'long'])
  expect(roomMentionMatches(bots, 'bot').map((bot) => bot.id)).toEqual(['notes'])
  expect(roomMentionMatches(bots, 'new b').map((bot) => bot.id)).toEqual(['notes'])
  expect(roomMentionMatches(bots, 'New Bot hello')).toEqual([])
})

it('inserts @Name in a form mentionedRoomBot matches, names with spaces included', () => {
  const bots = [expi, notes, longer]
  for (const bot of bots) {
    const draft = 'hi @'
    const inserted = insertRoomMention(draft, roomMentionQuery(draft, draft.length)!, bot.name)
    expect(inserted.text).toBe(`hi @${bot.name} `)
    expect(inserted.caret).toBe(inserted.text.length)
    expect(mentionedRoomBot(`${inserted.text}what is for dinner?`, bots)?.id).toBe(bot.id)
  }
})

it('replaces only the typed token and keeps the rest of the line', () => {
  const draft = '@New B what now'
  const inserted = insertRoomMention(draft, roomMentionQuery(draft, 6)!, ' New Bot ')
  expect(inserted.text).toBe('@New Bot what now')
  expect(inserted.caret).toBe('@New Bot '.length)
  expect(mentionedRoomBot(inserted.text, [notes])?.id).toBe('notes')

  const punct = '@Ex, please'
  const beforeComma = insertRoomMention(punct, roomMentionQuery(punct, 3)!, 'Expi')
  expect(beforeComma.text).toBe('@Expi, please')
  expect(beforeComma.caret).toBe(5)
  expect(mentionedRoomBot(beforeComma.text, [expi])?.id).toBe('expi')
})
