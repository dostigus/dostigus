import type { OpenedStore } from '../../src/index'
import { DatabaseSync as Sqlite } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import {
  createBot,
  createMember,
  createMessengerThread,
  createOwner,
  getMessengerThread,
  grantBot,
  listInboxThreads,
  openStore,
  STORE_MIGRATIONS,
  StoreError,
  updateThreadCase,
} from '../../src/index'

const stores: OpenedStore[] = []

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close()
  }
})

function memoryStore() {
  const store = openStore('file::memory:')
  stores.push(store)
  return store
}

function household(store: OpenedStore) {
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const grace = createMember(store, { displayName: 'Grace', username: 'grace', passwordHash: 'hash:grace' })
  const lin = createMember(store, { displayName: 'Lin', username: 'lin', passwordHash: 'hash:lin' })
  return { owner, grace, lin }
}

it('sends case null on an untouched group, then creates the Case on the first write', () => {
  const store = memoryStore()
  const { owner, grace } = household(store)
  const group = createMessengerThread(store, { kind: 'group', title: 'Trip', actorId: owner.id, personIds: [grace.id] })
  expect(group.case).toBeNull()
  expect(getMessengerThread(store, group.id, grace.id).case).toBeNull()

  const first = updateThreadCase(store, { threadId: group.id, actorId: grace.id, label: '  Visa  ' })
  expect(first.case).toEqual({ status: 'open', label: 'Visa', nextAction: '', followUpAt: null, followUpBotId: null })

  const next = updateThreadCase(store, { threadId: group.id, actorId: owner.id, nextAction: 'Book the consulate slot' })
  expect(next.case).toEqual({ status: 'open', label: 'Visa', nextAction: 'Book the consulate slot', followUpAt: null, followUpBotId: null })

  const row = listInboxThreads(store, { id: grace.id, role: 'member' }).find((item) => item.id === group.id)
  expect(row?.case).toEqual(next.case)
})

it('flips done and open without archiving the Thread', () => {
  const store = memoryStore()
  const { owner, grace } = household(store)
  const group = createMessengerThread(store, { kind: 'group', title: 'Trip', actorId: owner.id, personIds: [grace.id] })

  const done = updateThreadCase(store, { threadId: group.id, actorId: owner.id, status: 'done' })
  expect(done.case).toEqual({ status: 'done', label: '', nextAction: '', followUpAt: null, followUpBotId: null })
  expect(listInboxThreads(store, { id: owner.id, role: 'owner' }).map((item) => item.id)).toContain(group.id)

  const reopened = updateThreadCase(store, { threadId: group.id, actorId: grace.id, status: 'open', label: 'Visa' })
  expect(reopened.case).toEqual({ status: 'open', label: 'Visa', nextAction: '', followUpAt: null, followUpBotId: null })
  expect(reopened.kind).toBe('group')
})

it('stores whitespace-only text as empty and keeps the status', () => {
  const store = memoryStore()
  const { owner, grace } = household(store)
  const group = createMessengerThread(store, { kind: 'group', title: 'Trip', actorId: owner.id, personIds: [grace.id] })
  updateThreadCase(store, { threadId: group.id, actorId: owner.id, status: 'done', label: 'Visa', nextAction: 'Call' })

  const cleared = updateThreadCase(store, { threadId: group.id, actorId: owner.id, label: '   ', nextAction: '\n' })
  expect(cleared.case).toEqual({ status: 'done', label: '', nextAction: '', followUpAt: null, followUpBotId: null })
})

it('writes a Case on a room', () => {
  const store = memoryStore()
  const { owner, grace } = household(store)
  const expi = createBot(store, { name: 'Expi', createdBy: owner.id }).bot
  grantBot(store, expi.id, grace.id)
  const room = createMessengerThread(store, {
    kind: 'room',
    title: 'Ops',
    actorId: owner.id,
    personIds: [grace.id],
    botIds: [expi.id],
  })
  const written = updateThreadCase(store, { threadId: room.id, actorId: grace.id, status: 'open', label: 'Deploy' })
  expect(written.case).toEqual({ status: 'open', label: 'Deploy', nextAction: '', followUpAt: null, followUpBotId: null })
})

it('rejects a Case on a dm and a bot-thread as not found', () => {
  const store = memoryStore()
  const { owner, grace } = household(store)
  const dm = createMessengerThread(store, { kind: 'dm', actorId: owner.id, personIds: [grace.id] })
  expect(dm.case).toBeNull()
  expect(() => updateThreadCase(store, { threadId: dm.id, actorId: owner.id, label: 'No' }))
    .toThrow(/Thread not found/)

  createBot(store, { name: 'Notes', createdBy: owner.id })
  const botThread = listInboxThreads(store, { id: owner.id, role: 'owner' }).find((item) => item.kind === 'bot')
  expect(botThread?.case).toBeNull()
  expect(() => updateThreadCase(store, { threadId: botThread?.id ?? '', actorId: owner.id, label: 'No' }))
    .toThrow(/Thread not found/)
})

it('lets only person participants write', () => {
  const store = memoryStore()
  const { owner, grace, lin } = household(store)
  const group = createMessengerThread(store, { kind: 'group', title: 'Trip', actorId: grace.id, personIds: [lin.id] })

  let caught: unknown
  try {
    updateThreadCase(store, { threadId: group.id, actorId: owner.id, label: 'Visa' })
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(StoreError)
  expect((caught as StoreError).statusCode).toBe(404)
  expect(getMessengerThread(store, group.id, grace.id).case).toBeNull()
})

it('validates the body', () => {
  const store = memoryStore()
  const { owner, grace } = household(store)
  const group = createMessengerThread(store, { kind: 'group', title: 'Trip', actorId: owner.id, personIds: [grace.id] })
  const write = (body: { status?: unknown, label?: unknown, nextAction?: unknown }) => updateThreadCase(store, {
    threadId: group.id,
    actorId: owner.id,
    ...body,
  })

  expect(() => write({})).toThrow(/status, label, next action, or follow-up/)
  expect(() => write({ status: 'closed' })).toThrow(/open or done/)
  expect(() => write({ label: 'x'.repeat(41) })).toThrow(/40 characters/)
  expect(() => write({ nextAction: 'x'.repeat(121) })).toThrow(/120 characters/)
  expect(() => write({ label: 3 })).toThrow(/text/)
  expect(getMessengerThread(store, group.id, owner.id).case).toBeNull()

  expect(write({ label: 'x'.repeat(40), nextAction: 'y'.repeat(120) }).case?.label).toHaveLength(40)
})

it('adds null Case columns to an existing Thread', () => {
  const sqlite = new Sqlite(':memory:')
  for (const migration of STORE_MIGRATIONS) {
    if (migration.id === '0026_thread_case') {
      break
    }
    sqlite.exec(migration.sql)
  }
  sqlite.prepare(`INSERT INTO threads (id, kind, bot_id, title, created_at) VALUES ('t1', 'group', NULL, 'Trip', 1)`).run()
  const migration = STORE_MIGRATIONS.find((item) => item.id === '0026_thread_case')
  if (!migration) {
    throw new Error('missing 0026_thread_case')
  }
  sqlite.exec(migration.sql)
  const row = sqlite.prepare('SELECT case_status, case_label, case_next_action FROM threads WHERE id = ?').get('t1')
  expect({ ...row }).toEqual({ case_status: null, case_label: null, case_next_action: null })
  sqlite.close()
})
