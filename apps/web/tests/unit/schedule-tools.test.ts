import {
  createBot,
  createMember,
  createOwner,
  openStore,
} from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import { invokeChatMcpTool } from '../../server/utils/mcp-platform-tools'

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

it('lets a Member create a daily Schedule on this Bot and keeps timezone set with the Owner', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const bot = createBot(store, { name: 'Notes', createdBy: member.id }).bot
  const other = createBot(store, { name: 'Other', createdBy: member.id }).bot

  const blockedTz = invokeChatMcpTool({
    name: 'dostigus_cluster_timezone_set',
    args: { timezone: 'America/New_York' },
    store,
    role: 'member',
    personId: member.id,
  })
  expect(blockedTz.ok).toBe(false)
  expect(JSON.parse(blockedTz.content)).toEqual({ error: 'unknown or unavailable tool' })

  const readTz = invokeChatMcpTool({
    name: 'dostigus_cluster_timezone_get',
    args: {},
    store,
    role: 'member',
    personId: member.id,
  })
  expect(readTz.ok).toBe(true)
  expect(JSON.parse(readTz.content)).toMatchObject({ effective: 'UTC', source: 'utc' })

  const wrongBot = invokeChatMcpTool({
    name: 'dostigus_schedules_create',
    args: {
      botId: other.id,
      cadence: 'daily',
      timeLocal: '08:00',
      wakeText: 'Nope',
    },
    store,
    role: 'member',
    personId: member.id,
    turnBotId: bot.id,
  })
  expect(wrongBot.ok).toBe(false)
  expect(JSON.parse(wrongBot.content).error).toContain('this Bot')

  const created = invokeChatMcpTool({
    name: 'dostigus_schedules_create',
    args: {
      botId: bot.id,
      cadence: 'daily',
      timeLocal: '08:00',
      wakeText: 'Morning briefing',
    },
    store,
    role: 'member',
    personId: member.id,
    turnBotId: bot.id,
  })
  expect(created.ok).toBe(true)
  const schedule = (JSON.parse(created.content) as { schedule: { id: string, personId: string, timeLocal: string } }).schedule
  expect(schedule.personId).toBe(member.id)
  expect(schedule.timeLocal).toBe('08:00')

  const paused = invokeChatMcpTool({
    name: 'dostigus_schedules_pause',
    args: { id: schedule.id },
    store,
    role: 'member',
    personId: member.id,
    turnBotId: bot.id,
  })
  expect(JSON.parse(paused.content)).toMatchObject({ schedule: { paused: true } })

  const ownerEdit = invokeChatMcpTool({
    name: 'dostigus_schedules_resume',
    args: { id: schedule.id },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
  })
  expect(ownerEdit.ok).toBe(true)
  expect(JSON.parse(ownerEdit.content)).toMatchObject({ schedule: { paused: false } })

  const setTz = invokeChatMcpTool({
    name: 'dostigus_cluster_timezone_set',
    args: { timezone: 'America/New_York' },
    store,
    role: 'owner',
    personId: owner.id,
  })
  expect(setTz.ok).toBe(true)
  expect(JSON.parse(setTz.content)).toMatchObject({
    stored: 'America/New_York',
    effective: 'America/New_York',
    source: 'store',
  })
})
