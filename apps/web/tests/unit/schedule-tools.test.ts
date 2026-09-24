import {
  createBot,
  createMember,
  createOwner,
  grantBot,
  openStore,
} from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import { invokeChatMcpTool } from '../../server/utils/mcp-platform-tools'
import { scheduleClosetList, scheduleSheetRead } from '../../server/utils/schedule-tools'

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

  const blockedAllowlist = invokeChatMcpTool({
    name: 'dostigus_cluster_http_allowlist_set',
    args: { hosts: ['api.example.com'] },
    store,
    role: 'member',
    personId: member.id,
  })
  expect(blockedAllowlist.ok).toBe(false)
  expect(JSON.parse(blockedAllowlist.content)).toEqual({ error: 'unknown or unavailable tool' })

  const blockedAllowlistGet = invokeChatMcpTool({
    name: 'dostigus_cluster_http_allowlist_get',
    args: {},
    store,
    role: 'member',
    personId: member.id,
  })
  expect(blockedAllowlistGet.ok).toBe(false)

  const setAllowlist = invokeChatMcpTool({
    name: 'dostigus_cluster_http_allowlist_set',
    args: { hosts: ['api.open-meteo.com'] },
    store,
    role: 'owner',
    personId: owner.id,
  })
  expect(setAllowlist.ok).toBe(true)
  expect(JSON.parse(setAllowlist.content)).toEqual({ hosts: ['api.open-meteo.com'] })
})

it('accepts optional name on create and update, and closet list is this person only', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  grantBot(store, bot.id, member.id)

  const created = invokeChatMcpTool({
    name: 'dostigus_schedules_create',
    args: {
      botId: bot.id,
      name: 'Morning',
      cadence: 'daily',
      timeLocal: '08:00',
      wakeText: 'Briefing',
    },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
  })
  expect(created.ok).toBe(true)
  const schedule = (JSON.parse(created.content) as { schedule: { id: string, name: string } }).schedule
  expect(schedule.name).toBe('Morning')

  const renamed = invokeChatMcpTool({
    name: 'dostigus_schedules_update',
    args: { id: schedule.id, name: '' },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
  })
  expect(JSON.parse(renamed.content)).toMatchObject({ schedule: { name: '' } })

  invokeChatMcpTool({
    name: 'dostigus_schedules_create',
    args: {
      botId: bot.id,
      name: 'Member row',
      cadence: 'daily',
      timeLocal: '09:00',
      wakeText: 'Member wake',
    },
    store,
    role: 'member',
    personId: member.id,
    turnBotId: bot.id,
  })

  const ownerList = scheduleClosetList(store, bot.id, { id: owner.id, role: 'owner' })
  expect(ownerList.schedules.map((row) => row.personId)).toEqual([owner.id])
  const memberList = scheduleClosetList(store, bot.id, { id: member.id, role: 'member' })
  expect(memberList.schedules).toHaveLength(1)
  expect(memberList.schedules[0]?.name).toBe('Member row')

  const read = scheduleSheetRead(store, schedule.id, { id: owner.id, role: 'owner' })
  expect(read.schedule.id).toBe(schedule.id)
  expect(read.runs).toEqual([])
  expect(read.timeZone).toBeTruthy()
})
