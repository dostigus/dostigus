import { afterEach, expect, it } from 'vitest'
import {
  createBot,
  createMember,
  createOwner,
  createSchedule,
  effectiveClusterTimeZone,
  listDueSchedules,
  openStore,
  pauseSchedule,
  resumeSchedule,
  setClusterTimeZone,
  StoreError,
  updateSchedule,
} from '../../src/index'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

const utc = { env: { DOSTIGUS_TZ: 'UTC' } }

it('stores a daily Schedule and recomputes next_run_at in the Cluster timezone', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const now = Date.parse('2026-01-15T07:00:00.000Z')
  const schedule = createSchedule(store, {
    botId: bot.id,
    personId: owner.id,
    cadence: 'daily',
    timeLocal: '8:00',
    wakeText: '  Morning briefing  ',
  }, { ...utc, now })
  expect(schedule.timeLocal).toBe('08:00')
  expect(schedule.wakeText).toBe('Morning briefing')
  expect(schedule.name).toBe('')
  expect(schedule.daysOfWeek).toBeNull()
  expect(schedule.paused).toBe(false)
  expect(schedule.nextRunAt).toBe('2026-01-15T08:00:00.000Z')
  expect(schedule.lastRunAt).toBeNull()

  const moved = setClusterTimeZone(store, 'America/New_York', { ...utc, now })
  expect(moved).toEqual({
    stored: 'America/New_York',
    effective: 'America/New_York',
    source: 'store',
  })
  const due = listDueSchedules(store, Date.parse('2026-01-15T13:00:00.000Z'))
  expect(due).toHaveLength(1)
  expect(due[0]?.timeLocal).toBe('08:00')
  expect(due[0]?.nextRunAt).toBe('2026-01-15T13:00:00.000Z')
})

it('uses DOSTIGUS_TZ when the Store timezone is unset, else UTC', () => {
  const store = memoryStore()
  expect(effectiveClusterTimeZone(store, {})).toEqual({
    stored: null,
    effective: 'UTC',
    source: 'utc',
  })
  expect(effectiveClusterTimeZone(store, { DOSTIGUS_TZ: 'Europe/Kyiv' }).effective).toBe('Europe/Kyiv')
  expect(effectiveClusterTimeZone(store, { DOSTIGUS_TZ: 'EST' }).effective).toBe('UTC')
  expect(() => setClusterTimeZone(store, 'EST')).toThrow(StoreError)
})

it('keeps weekly weekdays and pauses without firing', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const now = Date.parse('2026-01-11T09:00:00.000Z')
  const schedule = createSchedule(store, {
    botId: bot.id,
    personId: owner.id,
    cadence: 'weekly',
    timeLocal: '08:00',
    daysOfWeek: ['wed', 'mon', 'mon'],
    wakeText: 'Weekday note',
  }, { ...utc, now })
  expect(schedule.daysOfWeek).toEqual(['mon', 'wed'])
  expect(schedule.nextRunAt).toBe('2026-01-12T08:00:00.000Z')

  const paused = pauseSchedule(store, schedule.id, { now })
  expect(paused.paused).toBe(true)
  expect(listDueSchedules(store, Date.parse('2026-01-12T08:00:00.000Z'))).toEqual([])

  const resumed = resumeSchedule(store, schedule.id, {
    ...utc,
    now: Date.parse('2026-01-12T09:00:00.000Z'),
  })
  expect(resumed.paused).toBe(false)
  expect(resumed.nextRunAt).toBe('2026-01-14T08:00:00.000Z')
})

it('rejects a weekly Schedule with no weekdays and a daily Schedule that lists them', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  expect(() => createSchedule(store, {
    botId: bot.id,
    personId: member.id,
    cadence: 'weekly',
    timeLocal: '08:00',
    wakeText: 'Nope',
  })).toThrow(StoreError)
  const daily = createSchedule(store, {
    botId: bot.id,
    personId: member.id,
    cadence: 'daily',
    timeLocal: '08:00',
    wakeText: 'Yes',
  }, utc)
  expect(() => updateSchedule(store, daily.id, {
    daysOfWeek: ['mon'],
  }, utc)).toThrow(/omitted for a daily/)
})

it('stores an optional name and clears it on update', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const named = createSchedule(store, {
    botId: bot.id,
    personId: owner.id,
    name: '  Morning  ',
    cadence: 'daily',
    timeLocal: '08:00',
    wakeText: 'Wake',
  }, utc)
  expect(named.name).toBe('Morning')
  const cleared = updateSchedule(store, named.id, { name: '' }, utc)
  expect(cleared.name).toBe('')
  expect(cleared.wakeText).toBe('Wake')
})
