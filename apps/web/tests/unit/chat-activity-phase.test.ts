import {
  botThreadIdFor,
  createBot,
  createMember,
  createMessengerThread,
  createOwner,
  grantBot,
  insertMessage,
  openStore,
  StoreError,
} from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import {
  clearChatActivityPhase,
  clearChatActivityPhases,
  messageThreadId,
  readChatActivityPhase,
  readThreadChatActivity,
  setChatActivityPhase,
} from '../../server/utils/chat-activity-phase'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

afterEach(() => {
  clearChatActivityPhases()
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('stores a phase on the viewer bot-thread and hides it from someone else', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const bot = createBot(store, { name: 'Expi', createdBy: owner.id }).bot
  const user = insertMessage(store, {
    botId: bot.id,
    role: 'user',
    content: 'hi',
    personId: owner.id,
    viewer: { id: owner.id, role: 'owner' },
  })
  const threadId = messageThreadId(store, user.id)
  expect(threadId).toBe(botThreadIdFor(bot.id, owner.id))

  setChatActivityPhase(threadId, bot.id, 'thinking')
  expect(readThreadChatActivity(store, {
    viewer: { id: owner.id, role: 'owner' },
    threadId,
    botId: bot.id,
  })).toEqual({ phase: 'thinking' })

  expect(() => readThreadChatActivity(store, {
    viewer: { id: member.id, role: 'member' },
    threadId,
    botId: bot.id,
  })).toThrow(StoreError)

  grantBot(store, bot.id, member.id)
  expect(readThreadChatActivity(store, {
    viewer: { id: member.id, role: 'member' },
    threadId: botThreadIdFor(bot.id, member.id),
    botId: bot.id,
  })).toEqual({ phase: null })
  expect(() => readThreadChatActivity(store, {
    viewer: { id: member.id, role: 'member' },
    threadId,
    botId: bot.id,
  })).toThrow(StoreError)

  setChatActivityPhase(threadId, bot.id, 'connect' as never)
  expect(readChatActivityPhase(threadId, bot.id)).toBe('thinking')
  clearChatActivityPhase(threadId, bot.id)
  expect(readThreadChatActivity(store, {
    viewer: { id: owner.id, role: 'owner' },
    threadId,
    botId: bot.id,
  })).toEqual({ phase: null })
})

it('shares a room phase with people on that room', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const outsider = createMember(store, {
    displayName: 'Bea',
    username: 'bea',
    passwordHash: 'hash:bea',
  })
  const bot = createBot(store, { name: 'Expi', createdBy: owner.id }).bot
  grantBot(store, bot.id, member.id)
  grantBot(store, bot.id, outsider.id)
  const room = createMessengerThread(store, {
    kind: 'room',
    title: 'Kitchen',
    actorId: owner.id,
    personIds: [member.id],
    botIds: [bot.id],
  })
  setChatActivityPhase(room.id, bot.id, 'tool')
  expect(readThreadChatActivity(store, {
    viewer: { id: member.id, role: 'member' },
    threadId: room.id,
    botId: bot.id,
  })).toEqual({ phase: 'tool' })
  expect(() => readThreadChatActivity(store, {
    viewer: { id: outsider.id, role: 'member' },
    threadId: room.id,
    botId: bot.id,
  })).toThrow(StoreError)

  const dm = createMessengerThread(store, {
    kind: 'dm',
    actorId: owner.id,
    personIds: [member.id],
  })
  expect(() => readThreadChatActivity(store, {
    viewer: { id: owner.id, role: 'owner' },
    threadId: dm.id,
    botId: bot.id,
  })).toThrow(StoreError)
})
