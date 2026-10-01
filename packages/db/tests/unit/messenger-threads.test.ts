import type { DatabaseSync } from 'node:sqlite'
import { DatabaseSync as Sqlite } from 'node:sqlite'
import { expect, it } from 'vitest'
import {
  addMessengerParticipant,
  appendMessengerUserLine,
  createBot,
  createMember,
  createMessengerThread,
  createOwner,
  getMessengerThread,
  grantBot,
  insertArtifactRow,
  insertThreadLine,
  joinMessageArtifacts,
  listBotGrants,
  listInboxThreads,
  listMessages,
  listRoomBotAudience,
  listThreadMessages,
  openStore,
  STORE_MIGRATIONS,
  StoreError,
} from '../../src/index'

function memoryStore() {
  return openStore('file::memory:')
}

function applyMemberLocale(sqlite: DatabaseSync) {
  const migration = STORE_MIGRATIONS.find((item) => item.id === '0022_member_locale')
  if (!migration) {
    throw new Error('missing 0022_member_locale')
  }
  sqlite.exec(migration.sql)
}

function applyThreadCase(sqlite: DatabaseSync) {
  const migration = STORE_MIGRATIONS.find((item) => item.id === '0026_thread_case')
  if (!migration) {
    throw new Error('missing 0026_thread_case')
  }
  sqlite.exec(migration.sql)
}

function applyBeforeMessenger(sqlite: DatabaseSync) {
  for (const migration of STORE_MIGRATIONS) {
    if (migration.id === '0012_messenger_threads') {
      applyMemberLocale(sqlite)
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
  applyThreadCase(sqlite)

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

  const ownerOnly = createBot(store, { name: 'Owner desk', createdBy: owner.id }).bot
  const beforeGrants = listBotGrants(store, shared.id).map((grant) => grant.personId)
  const ownerAudience = listRoomBotAudience(store, { id: owner.id, role: 'owner' })
  expect(ownerAudience.find((row) => row.botId === shared.id)?.personIds).toEqual([owner.id, member.id])
  expect(ownerAudience.find((row) => row.botId === priv.id)?.personIds).toEqual([owner.id, member.id])
  expect(ownerAudience.find((row) => row.botId === ownerOnly.id)?.personIds).toEqual([owner.id])
  const memberAudience = listRoomBotAudience(store, { id: member.id, role: 'member' })
  expect(memberAudience.map((row) => row.botId)).toContain(priv.id)
  expect(memberAudience.map((row) => row.botId)).toContain(shared.id)
  expect(memberAudience.map((row) => row.botId)).not.toContain(ownerOnly.id)
  expect(listBotGrants(store, shared.id).map((grant) => grant.personId)).toEqual(beforeGrants)
  expect(listBotGrants(store, ownerOnly.id)).toEqual([])

  expect(() => getMessengerThread(store, room.id, 'missing')).toThrow(StoreError)
  const inbox = listInboxThreads(store, { id: owner.id, role: 'owner' })
  expect(inbox.some((item) => item.id === dm.id)).toBe(true)
  expect(inbox.some((item) => item.id === room.id)).toBe(true)
  expect(inbox.some((item) => item.kind === 'bot' && item.botId === shared.id)).toBe(true)
  expect(inbox.some((item) => item.kind === 'bot' && item.botId === priv.id)).toBe(true)

  store.close()
})

it('previews an Artifact-only line by its filenames in the inbox', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
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
  const files = ['receipt.png', 'notes.md'].map((filename, index) => insertArtifactRow(store, {
    filename,
    mime: index === 0 ? 'image/png' : 'text/markdown',
    byteSize: 12,
    contentHash: `hash-${index}`,
    actorPersonId: owner.id,
  }))
  const line = appendMessengerUserLine(store, {
    threadId: dm.id,
    personId: owner.id,
    content: '',
    allowEmpty: true,
  })
  joinMessageArtifacts(store, line.id, files.map((file) => file.id))

  const row = listInboxThreads(store, { id: member.id, role: 'member' })
    .find((item) => item.id === dm.id)
  expect(row?.lastMessage?.content).toBe('receipt.png, notes.md')
  store.close()
})

it('adds a person and a Bot after create without granting, and turns a group into a room', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const grace = createMember(store, { displayName: 'Grace', username: 'grace', passwordHash: 'hash:grace' })
  const lin = createMember(store, { displayName: 'Lin', username: 'lin', passwordHash: 'hash:lin' })
  const expi = createBot(store, { name: 'Expi', createdBy: owner.id }).bot
  const notes = createBot(store, { name: 'Notes', createdBy: owner.id }).bot

  const dm = createMessengerThread(store, { kind: 'dm', actorId: owner.id, personIds: [grace.id] })
  expect(() => addMessengerParticipant(store, {
    threadId: dm.id,
    actorId: owner.id,
    kind: 'person',
    id: lin.id,
  })).toThrow(/direct message/)

  const group = createMessengerThread(store, {
    kind: 'group',
    title: 'Household',
    actorId: owner.id,
    personIds: [grace.id],
  })
  appendMessengerUserLine(store, { threadId: group.id, personId: owner.id, content: 'before Lin' })
  expect(() => getMessengerThread(store, group.id, lin.id)).toThrow(StoreError)

  const withLin = addMessengerParticipant(store, {
    threadId: group.id,
    actorId: grace.id,
    kind: 'person',
    id: lin.id,
  })
  expect(withLin.kind).toBe('group')
  expect(getMessengerThread(store, group.id, lin.id).title).toBe('Household')
  expect(listThreadMessages(store, group.id).map((line) => line.content)).toEqual(['before Lin'])
  expect(() => addMessengerParticipant(store, {
    threadId: group.id,
    actorId: owner.id,
    kind: 'person',
    id: lin.id,
  })).toThrow(/Already/)

  expect(() => addMessengerParticipant(store, {
    threadId: group.id,
    actorId: owner.id,
    kind: 'bot',
    id: expi.id,
  })).toThrow(/already have access/)
  expect(getMessengerThread(store, group.id, owner.id).kind).toBe('group')
  expect(listBotGrants(store, expi.id)).toEqual([])

  grantBot(store, expi.id, grace.id)
  grantBot(store, expi.id, lin.id)
  const room = addMessengerParticipant(store, {
    threadId: group.id,
    actorId: lin.id,
    kind: 'bot',
    id: expi.id,
  })
  expect(room.kind).toBe('room')
  expect(room.title).toBe('Household')
  expect(room.participants.filter((p) => p.kind === 'person').map((p) => p.id).sort())
    .toEqual([owner.id, grace.id, lin.id].sort())
  expect(listBotGrants(store, expi.id).map((grant) => grant.personId).sort()).toEqual([grace.id, lin.id].sort())

  grantBot(store, notes.id, grace.id)
  expect(() => addMessengerParticipant(store, {
    threadId: group.id,
    actorId: owner.id,
    kind: 'bot',
    id: notes.id,
  })).toThrow(/already have access/)
  grantBot(store, notes.id, lin.id)
  const twoBots = addMessengerParticipant(store, {
    threadId: group.id,
    actorId: owner.id,
    kind: 'bot',
    id: notes.id,
  })
  expect(twoBots.participants.filter((p) => p.kind === 'bot').map((p) => p.id).sort())
    .toEqual([expi.id, notes.id].sort())

  const newcomer = createMember(store, { displayName: 'Mo', username: 'mo', passwordHash: 'hash:mo' })
  expect(() => addMessengerParticipant(store, {
    threadId: group.id,
    actorId: owner.id,
    kind: 'person',
    id: newcomer.id,
  })).toThrow(/already have access/)
  expect(listBotGrants(store, expi.id).map((grant) => grant.personId)).not.toContain(newcomer.id)

  expect(() => addMessengerParticipant(store, {
    threadId: group.id,
    actorId: newcomer.id,
    kind: 'person',
    id: newcomer.id,
  })).toThrow(/Thread not found/)
  store.close()
})
