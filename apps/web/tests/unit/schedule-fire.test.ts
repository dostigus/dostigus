import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createBot,
  createMember,
  createOwner,
  createSchedule,
  grantBot,
  listBotThreadMessages,
  openStore,
  revokeBotGrant,
  SCHEDULE_CATCH_UP_MS,
  SCHEDULE_DEFER_LIMIT,
  SCHEDULE_DEFER_MS,
} from '@dostigus/db'
import { STUB_ASSISTANT_REPLY } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import {
  clearChatActivityPhases,
  readChatActivityPhase,
  setChatActivityPhase,
} from '../../server/utils/chat-activity-phase'
import { flushScheduleWakes, runScheduleTick } from '../../server/utils/schedule-ticker'
import { resetChatTurnJournal } from '../../server/utils/turn-journal'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

function dueAt(store: ReturnType<typeof openStore>, id: string, at: number, deferCount = 0) {
  store.sqlite.prepare(`
    UPDATE schedules SET next_run_at = ?, defer_count = ? WHERE id = ?
  `).run(at, deferCount, id)
}

afterEach(async () => {
  clearChatActivityPhases()
  await flushScheduleWakes()
  resetChatTurnJournal()
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('starts the Schedule ticker when the Host opens the Store', () => {
  const src = readFileSync(join(import.meta.dirname, '../../server/plugins/store.ts'), 'utf8')
  expect(src).toContain('startScheduleTicker')
  expect(src).toContain('stopScheduleTicker')
})

it('fires a Wake inside the catch-up window and skips when lateness is 30 minutes', async () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const now = Date.parse('2026-01-15T08:10:00.000Z')
  const schedule = createSchedule(store, {
    botId: bot.id,
    personId: owner.id,
    cadence: 'daily',
    timeLocal: '08:00',
    wakeText: 'Morning briefing',
  }, { now, env: {} })
  dueAt(store, schedule.id, now - SCHEDULE_CATCH_UP_MS + 1)

  runScheduleTick({ store, now, env: {} })
  await flushScheduleWakes()

  const fired = listBotThreadMessages(store, bot.id, owner.id)
  expect(fired.map((message) => message.role)).toEqual(['assistant', 'system', 'assistant'])
  expect(fired[1]?.content).toBe('Morning briefing')
  expect(fired[2]?.content).toBe(STUB_ASSISTANT_REPLY)
  const row = store.sqlite.prepare(`
    SELECT next_run_at, last_run_status FROM schedules WHERE id = ?
  `).get(schedule.id) as { next_run_at: number, last_run_status: string }
  expect(row.last_run_status).toBe('fired')
  expect(row.next_run_at).toBe(Date.parse('2026-01-16T08:00:00.000Z'))

  const late = createSchedule(store, {
    botId: bot.id,
    personId: owner.id,
    cadence: 'daily',
    timeLocal: '09:00',
    wakeText: 'Too late',
  }, { now, env: {} })
  dueAt(store, late.id, now - SCHEDULE_CATCH_UP_MS)
  const before = listBotThreadMessages(store, bot.id, owner.id).length
  runScheduleTick({ store, now, env: {} })
  await flushScheduleWakes()
  expect(listBotThreadMessages(store, bot.id, owner.id)).toHaveLength(before)
  const skipped = store.sqlite.prepare(`
    SELECT next_run_at, last_run_status FROM schedules WHERE id = ?
  `).get(late.id) as { next_run_at: number, last_run_status: string }
  expect(skipped.last_run_status).toBe('skipped_late')
  expect(skipped.next_run_at).toBe(Date.parse('2026-01-15T09:00:00.000Z'))
})

it('defers while a reply is in flight and skips after five defers', async () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const now = Date.parse('2026-01-15T08:00:00.000Z')
  const first = createSchedule(store, {
    botId: bot.id,
    personId: owner.id,
    cadence: 'daily',
    timeLocal: '08:00',
    wakeText: 'First',
  }, { now, env: {} })
  const second = createSchedule(store, {
    botId: bot.id,
    personId: owner.id,
    cadence: 'daily',
    timeLocal: '08:00',
    wakeText: 'Second',
  }, { now, env: {} })
  dueAt(store, first.id, now - 2_000)
  dueAt(store, second.id, now - 1_000)

  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let phaseDuring: string | null = null
  runScheduleTick({
    store,
    now,
    env: {},
    completeReply: async () => {
      phaseDuring = readChatActivityPhase(`bt:${bot.id}:${owner.id}`, bot.id)
      await gate
      return { content: 'awake', via: 'stub' }
    },
  })

  const deferred = store.sqlite.prepare(`
    SELECT next_run_at, last_run_status, defer_count FROM schedules WHERE id = ?
  `).get(second.id) as { next_run_at: number, last_run_status: string, defer_count: number }
  expect(phaseDuring).toBe('thinking')
  expect(deferred).toEqual({
    next_run_at: now + SCHEDULE_DEFER_MS,
    last_run_status: 'deferred',
    defer_count: 1,
  })
  expect(listBotThreadMessages(store, bot.id, owner.id).filter((message) => message.role === 'system'))
    .toEqual([expect.objectContaining({ content: 'First' })])

  release()
  await flushScheduleWakes()
  expect(readChatActivityPhase(`bt:${bot.id}:${owner.id}`, bot.id)).toBeNull()

  dueAt(store, second.id, now, SCHEDULE_DEFER_LIMIT)
  setChatActivityPhase(`bt:${bot.id}:${owner.id}`, bot.id, 'thinking')
  runScheduleTick({ store, now, env: {} })
  await flushScheduleWakes()
  const skipped = store.sqlite.prepare(`
    SELECT last_run_status, defer_count, next_run_at FROM schedules WHERE id = ?
  `).get(second.id) as { last_run_status: string, defer_count: number, next_run_at: number }
  expect(skipped.last_run_status).toBe('skipped_busy')
  expect(skipped.defer_count).toBe(0)
  expect(skipped.next_run_at).toBeGreaterThan(now)
  expect(listBotThreadMessages(store, bot.id, owner.id).some((message) => message.content === 'Second')).toBe(false)
})

it('leaves a revoked grant due until access returns, and skips once the window passes', async () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  grantBot(store, bot.id, member.id)
  const now = Date.parse('2026-01-15T08:05:00.000Z')
  const schedule = createSchedule(store, {
    botId: bot.id,
    personId: member.id,
    cadence: 'daily',
    timeLocal: '08:00',
    wakeText: 'For Grace',
  }, { now, env: {} })
  const planned = now - 60_000
  dueAt(store, schedule.id, planned)
  revokeBotGrant(store, bot.id, member.id)

  runScheduleTick({ store, now, env: {} })
  await flushScheduleWakes()
  const held = store.sqlite.prepare(`
    SELECT next_run_at, last_run_status FROM schedules WHERE id = ?
  `).get(schedule.id) as { next_run_at: number, last_run_status: string | null }
  expect(held.next_run_at).toBe(planned)
  expect(held.last_run_status).toBeNull()
  expect(listBotThreadMessages(store, bot.id, member.id).some((message) => message.role === 'system')).toBe(false)

  const late = now + SCHEDULE_CATCH_UP_MS
  runScheduleTick({ store, now: late, env: {} })
  await flushScheduleWakes()
  const skipped = store.sqlite.prepare(`
    SELECT next_run_at, last_run_status FROM schedules WHERE id = ?
  `).get(schedule.id) as { next_run_at: number, last_run_status: string }
  expect(skipped.last_run_status).toBe('skipped_late')
  expect(skipped.next_run_at).toBeGreaterThan(late)
  expect(listBotThreadMessages(store, bot.id, member.id).some((message) => message.role === 'system')).toBe(false)
})

it('does not fire a paused Schedule', async () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const now = Date.parse('2026-01-15T08:00:00.000Z')
  const schedule = createSchedule(store, {
    botId: bot.id,
    personId: owner.id,
    cadence: 'daily',
    timeLocal: '08:00',
    wakeText: 'Paused',
  }, { now, env: {} })
  store.sqlite.prepare('UPDATE schedules SET paused = 1, next_run_at = ? WHERE id = ?').run(now - 1000, schedule.id)
  runScheduleTick({ store, now, env: {} })
  await flushScheduleWakes()
  const row = store.sqlite.prepare('SELECT next_run_at FROM schedules WHERE id = ?').get(schedule.id) as { next_run_at: number }
  expect(row.next_run_at).toBe(now - 1000)
  expect(listBotThreadMessages(store, bot.id, owner.id).some((message) => message.role === 'system')).toBe(false)
})
