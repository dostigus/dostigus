import type { OpenedStore } from '../../src/index'
import { DatabaseSync as Sqlite } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import {
  claimCaseFollowUp,
  createBot,
  createMember,
  createMessengerThread,
  createOwner,
  deleteBot,
  getMessengerThread,
  grantBot,
  listDueCaseFollowUps,
  listInboxThreads,
  openStore,
  setClusterTimeZone,
  STORE_MIGRATIONS,
  updateThreadCase,
} from '../../src/index'

const stores: OpenedStore[] = []

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close()
  }
})

const NOW = Date.parse('2026-10-01T10:00:00.000Z')
const clock = { now: NOW, env: {} }

function room() {
  const store = openStore('file::memory:')
  stores.push(store)
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const grace = createMember(store, { displayName: 'Grace', username: 'grace', passwordHash: 'hash:grace' })
  const lin = createMember(store, { displayName: 'Lin', username: 'lin', passwordHash: 'hash:lin' })
  const expi = createBot(store, { name: 'Expi', createdBy: owner.id }).bot
  const notes = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  grantBot(store, expi.id, grace.id)
  const thread = createMessengerThread(store, {
    kind: 'room',
    title: 'Ops',
    actorId: owner.id,
    personIds: [grace.id],
    botIds: [expi.id],
  })
  return { store, owner, grace, lin, expi, notes, thread }
}

it('sets a follow-up with a Bot Participant and nests it on the Case', () => {
  const { store, grace, expi, thread } = room()
  const written = updateThreadCase(store, {
    threadId: thread.id,
    actorId: grace.id,
    label: 'Deploy',
    nextAction: 'Check the canary',
    followUpAt: '2026-10-02T09:00:00.000Z',
    followUpBotId: expi.id,
  }, clock)
  expect(written.case).toEqual({
    status: 'open',
    label: 'Deploy',
    nextAction: 'Check the canary',
    followUpAt: '2026-10-02T09:00:00.000Z',
    followUpBotId: expi.id,
  })

  const relabeled = updateThreadCase(store, { threadId: thread.id, actorId: grace.id, label: 'Ship' }, clock)
  expect(relabeled.case?.followUpAt).toBe('2026-10-02T09:00:00.000Z')
  expect(relabeled.case?.followUpBotId).toBe(expi.id)

  const cleared = updateThreadCase(store, { threadId: thread.id, actorId: grace.id, followUpAt: null }, clock)
  expect(cleared.case).toMatchObject({ status: 'open', followUpAt: null, followUpBotId: null })
})

it('reads a wall clock in the Cluster timezone', () => {
  const { store, owner, expi, thread } = room()
  setClusterTimeZone(store, 'Europe/Berlin', clock)
  const written = updateThreadCase(store, {
    threadId: thread.id,
    actorId: owner.id,
    followUpAt: '2026-10-02T09:00',
    followUpBotId: expi.id,
  }, clock)
  expect(written.case?.followUpAt).toBe('2026-10-02T07:00:00.000Z')
})

it('rejects a follow-up without a Bot, with a Bot not on the Thread, or in the past', () => {
  const { store, owner, expi, notes, thread } = room()
  const write = (body: { followUpAt?: unknown, followUpBotId?: unknown, status?: unknown }) => updateThreadCase(store, {
    threadId: thread.id,
    actorId: owner.id,
    ...body,
  }, clock)
  expect(() => write({ followUpAt: '2026-10-02T09:00:00Z' })).toThrow(/Pick a Bot/)
  expect(() => write({ followUpAt: '2026-10-02T09:00:00Z', followUpBotId: notes.id })).toThrow(/must be in this Thread/)
  expect(() => write({ followUpAt: '2026-10-01T09:00:00Z', followUpBotId: expi.id })).toThrow(/in the future/)
  expect(() => write({ followUpAt: 'tomorrow', followUpBotId: expi.id })).toThrow(/date and time/)
  expect(() => write({ followUpAt: '2026-10-02T09:00:00', followUpBotId: expi.id })).toThrow(/date and time/)
  expect(() => write({ followUpAt: '2026-02-30T09:00', followUpBotId: expi.id })).toThrow(/date and time/)
  expect(() => write({ followUpBotId: expi.id })).toThrow(/Set a follow-up time/)
  expect(() => write({ status: 'done', followUpAt: '2026-10-02T09:00:00Z', followUpBotId: expi.id }))
    .toThrow(/done Case has no follow-up/)
  expect(getMessengerThread(store, thread.id, owner.id).case).toBeNull()
})

it('clears the follow-up when the Case is marked done', () => {
  const { store, grace, expi, thread } = room()
  updateThreadCase(store, {
    threadId: thread.id,
    actorId: grace.id,
    followUpAt: '2026-10-02T09:00:00Z',
    followUpBotId: expi.id,
  }, clock)
  const done = updateThreadCase(store, { threadId: thread.id, actorId: grace.id, status: 'done' }, clock)
  expect(done.case).toMatchObject({ status: 'done', followUpAt: null, followUpBotId: null })
  expect(listDueCaseFollowUps(store, Date.parse('2026-10-03T00:00:00Z'))).toEqual([])
})

it('lists only open Cases the signed-in person is on', () => {
  const { store, owner, grace, lin, thread } = room()
  const group = createMessengerThread(store, { kind: 'group', title: 'Trip', actorId: owner.id, personIds: [grace.id] })
  const linGroup = createMessengerThread(store, { kind: 'group', title: 'Books', actorId: lin.id, personIds: [grace.id] })
  createMessengerThread(store, { kind: 'group', title: 'No Case', actorId: owner.id, personIds: [grace.id] })
  updateThreadCase(store, { threadId: thread.id, actorId: owner.id, label: 'Deploy' })
  updateThreadCase(store, { threadId: group.id, actorId: owner.id, status: 'done' })
  updateThreadCase(store, { threadId: linGroup.id, actorId: lin.id, label: 'Read' })

  const forOwner = listInboxThreads(store, { id: owner.id, role: 'owner' }, { caseStatus: 'open' })
  expect(forOwner.map((item) => item.id)).toEqual([thread.id])
  const forGrace = listInboxThreads(store, { id: grace.id, role: 'member' }, { caseStatus: 'open' })
  expect(forGrace.map((item) => item.id).sort()).toEqual([thread.id, linGroup.id].sort())
  expect(listInboxThreads(store, { id: owner.id, role: 'owner' }).map((item) => item.id)).toContain(group.id)
})

it('claims a due follow-up once and says who the turn runs for', () => {
  const { store, owner, expi, thread } = room()
  updateThreadCase(store, {
    threadId: thread.id,
    actorId: owner.id,
    label: 'Deploy',
    nextAction: 'Check the canary',
    followUpAt: '2026-10-01T10:05:00Z',
    followUpBotId: expi.id,
  }, clock)
  expect(listDueCaseFollowUps(store, NOW)).toEqual([])
  const due = listDueCaseFollowUps(store, Date.parse('2026-10-01T10:05:00Z'))
  expect(due).toEqual([{ threadId: thread.id, botId: expi.id, followUpAt: Date.parse('2026-10-01T10:05:00Z') }])
  const first = claimCaseFollowUp(store, due[0]!)
  expect(first).toMatchObject({
    outcome: 'fire',
    threadId: thread.id,
    botId: expi.id,
    personId: owner.id,
    title: 'Ops',
    label: 'Deploy',
    nextAction: 'Check the canary',
  })
  expect(claimCaseFollowUp(store, due[0]!)).toEqual({ outcome: 'gone' })
  expect(getMessengerThread(store, thread.id, owner.id).case).toMatchObject({
    status: 'open',
    followUpAt: null,
    followUpBotId: null,
  })
})

it('prefers an Owner person Participant over the first person by insert order', () => {
  const { store, owner, grace, expi, thread } = room()
  const people = store.sqlite.prepare(`
    SELECT ref_id FROM thread_participants
    WHERE thread_id = ? AND kind = 'person'
    ORDER BY rowid ASC
  `).all(thread.id) as { ref_id: string }[]
  expect(people.map((row) => row.ref_id)).toEqual([grace.id, owner.id])
  updateThreadCase(store, {
    threadId: thread.id,
    actorId: grace.id,
    followUpAt: '2026-10-01T10:05:00Z',
    followUpBotId: expi.id,
  }, clock)
  const [due] = listDueCaseFollowUps(store, Date.parse('2026-10-01T10:05:00Z'))
  expect(claimCaseFollowUp(store, due!)).toMatchObject({ outcome: 'fire', personId: owner.id })
})

it('falls back to the first person Participant when the Owner is not on the Thread', () => {
  const { store, grace, lin, expi } = room()
  grantBot(store, expi.id, lin.id)
  const thread = createMessengerThread(store, {
    kind: 'room',
    title: 'Books',
    actorId: grace.id,
    personIds: [lin.id],
    botIds: [expi.id],
  })
  updateThreadCase(store, {
    threadId: thread.id,
    actorId: grace.id,
    followUpAt: '2026-10-01T10:05:00Z',
    followUpBotId: expi.id,
  }, clock)
  const [due] = listDueCaseFollowUps(store, Date.parse('2026-10-01T10:05:00Z'))
  expect(claimCaseFollowUp(store, due!)).toMatchObject({ outcome: 'fire', personId: lin.id })
})

it('skips and clears when the Bot left the Thread, and keeps the Case open', () => {
  const { store, owner, expi, thread } = room()
  updateThreadCase(store, {
    threadId: thread.id,
    actorId: owner.id,
    followUpAt: '2026-10-01T10:05:00Z',
    followUpBotId: expi.id,
  }, clock)
  store.sqlite.prepare(`DELETE FROM thread_participants WHERE thread_id = ? AND kind = 'bot'`).run(thread.id)
  const [due] = listDueCaseFollowUps(store, Date.parse('2026-10-01T11:00:00Z'))
  expect(claimCaseFollowUp(store, due!)).toEqual({ outcome: 'skipped_bot' })
  expect(getMessengerThread(store, thread.id, owner.id).case).toMatchObject({ status: 'open', followUpAt: null })
})

it('clears the follow-up when its Bot is deleted', () => {
  const { store, owner, expi, thread } = room()
  updateThreadCase(store, {
    threadId: thread.id,
    actorId: owner.id,
    followUpAt: '2026-10-02T09:00:00Z',
    followUpBotId: expi.id,
  }, clock)
  deleteBot(store, expi.id)
  expect(getMessengerThread(store, thread.id, owner.id).case).toMatchObject({ status: 'open', followUpAt: null })
})

it('adds null follow-up columns to an existing Thread', () => {
  const sqlite = new Sqlite(':memory:')
  for (const migration of STORE_MIGRATIONS) {
    if (migration.id === '0028_thread_case_follow_up') {
      break
    }
    sqlite.exec(migration.sql)
  }
  sqlite.prepare(`
    INSERT INTO threads (id, kind, bot_id, title, created_at, case_status) VALUES ('t1', 'room', NULL, 'Ops', 1, 'open')
  `).run()
  const migration = STORE_MIGRATIONS.find((item) => item.id === '0028_thread_case_follow_up')
  if (!migration) {
    throw new Error('missing 0028_thread_case_follow_up')
  }
  sqlite.exec(migration.sql)
  const row = sqlite.prepare('SELECT case_follow_up_at, case_follow_up_bot_id FROM threads WHERE id = ?').get('t1')
  expect({ ...row }).toEqual({ case_follow_up_at: null, case_follow_up_bot_id: null })
  sqlite.close()
})
