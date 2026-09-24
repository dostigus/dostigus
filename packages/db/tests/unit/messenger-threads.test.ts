import type { DatabaseSync } from 'node:sqlite'
import { DatabaseSync as Sqlite } from 'node:sqlite'
import { expect, it } from 'vitest'
import {
  appendMessengerUserLine,
  createBot,
  createMember,
  createMessengerThread,
  createOwner,
  getMessengerThread,
  grantBot,
  insertThreadLine,
  listBotGrants,
  listInboxThreads,
  listMessages,
  listThreadMessages,
  openStore,
  STORE_MIGRATIONS,
  StoreError,
} from '../../src/index'

function memoryStore() {
  return openStore('file::memory:')
}

function applyBeforeMessenger(sqlite: DatabaseSync) {
  for (const migration of STORE_MIGRATIONS) {
    if (migration.id === '0012_messenger_threads') {
      return
    }
    sqlite.exec(migration.sql)
  }
}

it('keeps bot-thread lines and allows a person line with no Bot', () => {
  const sqlite = new Sqlite(':memory:')
  applyBeforeMessenger(sqlite)
  const store = { sqlite, close: () => sqlite.close() }
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const created = createBot(store, { name: 'Notes', createdBy: owner.id })
  const before = listMessages(store, created.bot.id)
  expect(before[0]?.botId).toBe(created.bot.id)

  const migration = STORE_MIGRATIONS.find((item) => item.id === '0012_messenger_threads')
  if (!migration) {
    throw new Error('missing 0012_messenger_threads')
  }
  sqlite.exec(migration.sql)

  expect(listMessages(store, created.bot.id)[0]?.botId).toBe(created.bot.id)
  const title = sqlite.prepare('SELECT title FROM threads LIMIT 1').get() as { title: string }
  expect(title.title).toBe('')

  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const dm = createMessengerThread(store, {
    kind: 'dm',
    actorId: owner.id,
    personIds: [member.id],
  })
  const line = insertThreadLine(store, {
    threadId: dm.id,
    role: 'user',
    content: 'hello',
    personId: owner.id,
    botId: null,
  })
  expect(line.botId).toBeNull()
  expect(listThreadMessages(store, dm.id).map((message) => message.content)).toEqual(['hello'])
  sqlite.close()
})

it('creates a dm once, a group, and a room only when every person can open the Bot', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const shared = createBot(store, { name: 'Expi', createdBy: owner.id }).bot
  const priv = createBot(store, {
    name: 'Notes',
    createdBy: member.id,
  }).bot

  const dm = createMessengerThread(store, {
    kind: 'dm',
    actorId: owner.id,
    personIds: [member.id],
  })
  const again = createMessengerThread(store, {
    kind: 'dm',
    actorId: member.id,
    personIds: [owner.id],
  })
  expect(again.id).toBe(dm.id)
  expect(dm.kind).toBe('dm')
  expect(dm.title).toBe('Grace')
  expect(getMessengerThread(store, dm.id, member.id).title).toBe('ada')

  expect(() => createMessengerThread(store, {
    kind: 'dm',
    actorId: owner.id,
    personIds: [],
  })).toThrow(StoreError)

  const group = createMessengerThread(store, {
    kind: 'group',
    title: 'Household',
    actorId: owner.id,
    personIds: [member.id],
  })
  expect(group.kind).toBe('group')
  expect(group.href).toBe(`/threads/${group.id}`)

  expect(() => createMessengerThread(store, {
    kind: 'room',
    title: 'Kitchen',
    actorId: owner.id,
    personIds: [member.id],
    botIds: [shared.id],
  })).toThrow(/already have access/)
  expect(listBotGrants(store, shared.id)).toEqual([])

  grantBot(store, shared.id, member.id)
  const room = createMessengerThread(store, {
    kind: 'room',
    title: 'Kitchen',
    actorId: member.id,
    personIds: [owner.id],
    botIds: [shared.id],
  })
  expect(room.participants.filter((person) => person.kind === 'bot').map((person) => person.id)).toEqual([shared.id])
  expect(listBotGrants(store, shared.id).map((grant) => grant.personId)).toEqual([member.id])
  appendMessengerUserLine(store, {
    threadId: room.id,
    personId: member.id,
    content: '@Expi what is for dinner',
  })
  expect(listThreadMessages(store, room.id)).toHaveLength(1)

  const memberRoom = createMessengerThread(store, {
    kind: 'room',
    title: 'Notes room',
    actorId: owner.id,
    personIds: [member.id],
    botIds: [priv.id],
  })
  expect(memberRoom.participants.filter((person) => person.kind === 'bot').map((person) => person.id)).toEqual([priv.id])
  expect(listBotGrants(store, priv.id)).toEqual([])

  expect(() => getMessengerThread(store, room.id, 'missing')).toThrow(StoreError)
  const inbox = listInboxThreads(store, { id: owner.id, role: 'owner' })
  expect(inbox.some((item) => item.id === dm.id)).toBe(true)
  expect(inbox.some((item) => item.id === room.id)).toBe(true)
  expect(inbox.some((item) => item.kind === 'bot' && item.botId === shared.id)).toBe(true)
  expect(inbox.some((item) => item.kind === 'bot' && item.botId === priv.id)).toBe(true)

  store.close()
})
