import {
  createBot,
  createMember,
  createOwner,
  grantBot,
  listBotSkills,
  listBotThreadMessages,
  listSchedules,
  openStore,
  StoreError,
} from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import { ChatCardTurn, noteToolCard } from '../../server/utils/chat-cards'
import { invokeChatMcpTool } from '../../server/utils/mcp-platform-tools'
import {
  scheduleSheetDelete,
  scheduleSheetRead,
  scheduleSheetSave,
} from '../../server/utils/schedule-tools'

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

const ACTIONS = [
  { label: 'Pause', action: { type: 'openSheet', sheetId: 'schedule' } },
  { label: 'Изменить', action: { type: 'openSheet', sheetId: 'schedule' } },
]

function createDaily(input: {
  store: ReturnType<typeof openStore>
  botId: string
  personId: string
  wakeText?: string
  timeLocal?: string
  cards?: ChatCardTurn
}) {
  return invokeChatMcpTool({
    name: 'dostigus_schedules_create',
    args: {
      botId: input.botId,
      cadence: 'daily',
      timeLocal: input.timeLocal ?? '08:00',
      wakeText: input.wakeText ?? 'Morning briefing',
    },
    store: input.store,
    role: 'owner',
    personId: input.personId,
    turnBotId: input.botId,
    cards: input.cards,
  })
}

it('injects one Schedule Card after create and replaces it on pause', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const cards = new ChatCardTurn()
  const created = createDaily({ store, botId: bot.id, personId: owner.id, cards })
  expect(created.ok).toBe(true)
  const schedule = (JSON.parse(created.content) as { schedule: { id: string } }).schedule
  expect(cards.parts()).toEqual([
    {
      kind: 'card',
      card: 'schedule',
      title: 'daily 08:00',
      body: 'Morning briefing',
      tone: 'ok',
      targetId: schedule.id,
      actions: ACTIONS,
    },
  ])

  const paused = invokeChatMcpTool({
    name: 'dostigus_schedules_pause',
    args: { id: schedule.id },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(paused.ok).toBe(true)
  expect(cards.parts()).toEqual([
    {
      kind: 'card',
      card: 'schedule',
      title: 'daily 08:00',
      body: 'На паузе',
      tone: 'warn',
      targetId: schedule.id,
      actions: ACTIONS,
    },
  ])

  const resumed = invokeChatMcpTool({
    name: 'dostigus_schedules_resume',
    args: { id: schedule.id },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(resumed.ok).toBe(true)
  expect(cards.parts()).toHaveLength(1)
  expect(cards.parts()[0]).toMatchObject({ body: 'Morning briefing', tone: 'ok', targetId: schedule.id })
})

it('treats an enabled equivalent as already standing and leaves a paused clock free', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const cards = new ChatCardTurn()
  const created = createDaily({
    store,
    botId: bot.id,
    personId: owner.id,
    wakeText: 'First wake',
    cards,
  })
  const first = (JSON.parse(created.content) as { schedule: { id: string, wakeText: string } }).schedule

  const listed = invokeChatMcpTool({
    name: 'dostigus_schedules_list',
    args: { botId: bot.id, intent: 'set', cadence: 'daily', timeLocal: '8:00' },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(JSON.parse(listed.content)).toMatchObject({
    already: true,
    schedule: { id: first.id, wakeText: 'First wake' },
  })
  expect(listSchedules(store, { botId: bot.id })).toHaveLength(1)
  expect(cards.parts()).toHaveLength(1)
  expect(cards.parts()[0]).toMatchObject({ body: 'уже стоит', tone: 'ok', targetId: first.id })

  const duplicate = createDaily({
    store,
    botId: bot.id,
    personId: owner.id,
    wakeText: 'Second wake',
    cards,
  })
  expect(JSON.parse(duplicate.content)).toMatchObject({
    already: true,
    schedule: { id: first.id, wakeText: 'First wake' },
  })
  expect(listSchedules(store, { botId: bot.id })).toHaveLength(1)
  expect(cards.parts()).toHaveLength(1)

  const plain = new ChatCardTurn()
  const quiet = invokeChatMcpTool({
    name: 'dostigus_schedules_list',
    args: { botId: bot.id },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards: plain,
  })
  expect(quiet.ok).toBe(true)
  expect(JSON.parse(quiet.content)).not.toHaveProperty('already')
  expect(plain.parts()).toEqual([])

  invokeChatMcpTool({
    name: 'dostigus_schedules_pause',
    args: { id: first.id },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
  })
  const afterPause = new ChatCardTurn()
  const again = createDaily({
    store,
    botId: bot.id,
    personId: owner.id,
    wakeText: 'After pause',
    cards: afterPause,
  })
  const second = JSON.parse(again.content) as { already?: boolean, schedule: { id: string, wakeText: string } }
  expect(second.already).toBeUndefined()
  expect(second.schedule.wakeText).toBe('After pause')
  expect(second.schedule.id).not.toBe(first.id)
  expect(listSchedules(store, { botId: bot.id })).toHaveLength(2)
  expect(afterPause.parts()[0]).toMatchObject({
    body: 'After pause',
    tone: 'ok',
    targetId: second.schedule.id,
  })
})

it('uses the title when wakeText is too long and names a weekly clock', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const cards = new ChatCardTurn()
  const longWake = 'x'.repeat(81)
  const created = createDaily({
    store,
    botId: bot.id,
    personId: owner.id,
    wakeText: longWake,
    cards,
  })
  const schedule = (JSON.parse(created.content) as { schedule: { id: string } }).schedule
  expect(cards.parts()[0]).toMatchObject({ title: 'daily 08:00', body: 'daily 08:00' })

  const weekly = invokeChatMcpTool({
    name: 'dostigus_schedules_create',
    args: {
      botId: bot.id,
      cadence: 'weekly',
      timeLocal: '08:00',
      daysOfWeek: ['wed', 'mon'],
      wakeText: 'Weekday note',
    },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(weekly.ok).toBe(true)
  expect(cards.parts().map((part) => part.title)).toEqual([
    'daily 08:00',
    'weekly mon wed 08:00',
  ])
  expect(cards.parts()[0]?.targetId).toBe(schedule.id)
})

it('injects a delete Card with no actions and a gone Sheet', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const cards = new ChatCardTurn()
  const created = createDaily({ store, botId: bot.id, personId: owner.id, cards })
  const schedule = (JSON.parse(created.content) as { schedule: { id: string } }).schedule

  const updated = invokeChatMcpTool({
    name: 'dostigus_schedules_update',
    args: { id: schedule.id, wakeText: 'Edited wake' },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(updated.ok).toBe(true)
  expect(cards.parts()).toHaveLength(1)
  expect(cards.parts()[0]).toMatchObject({ body: 'Edited wake', tone: 'ok' })

  const removed = invokeChatMcpTool({
    name: 'dostigus_schedules_delete',
    args: { id: schedule.id },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(JSON.parse(removed.content)).toMatchObject({ ok: true, schedule: { id: schedule.id } })
  expect(cards.parts()).toEqual([
    {
      kind: 'card',
      card: 'schedule',
      title: 'daily 08:00',
      body: 'Удалено',
      tone: 'warn',
      targetId: schedule.id,
      actions: [],
    },
  ])

  const ownerViewer = { id: owner.id, role: 'owner' as const }
  expect(() => scheduleSheetRead(store, schedule.id, ownerViewer)).toThrow(StoreError)
  try {
    scheduleSheetRead(store, schedule.id, ownerViewer)
  } catch (error) {
    expect(error).toMatchObject({ statusCode: 404, message: 'This Schedule is gone' })
  }
  expect(() => scheduleSheetRead(store, schedule.id, { id: member.id, role: 'member' })).toThrow(StoreError)
})

it('saves and deletes one Schedule from the Sheet', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const created = createDaily({ store, botId: bot.id, personId: owner.id, wakeText: 'Keep' })
  const id = (JSON.parse(created.content) as { schedule: { id: string } }).schedule.id
  const viewer = { id: owner.id, role: 'owner' as const }
  const saved = scheduleSheetSave(store, id, {
    cadence: 'weekly',
    timeLocal: '09:15',
    daysOfWeek: ['fri'],
    wakeText: 'Friday',
    paused: true,
  }, viewer)
  expect(saved.schedule).toMatchObject({
    cadence: 'weekly',
    timeLocal: '09:15',
    daysOfWeek: ['fri'],
    wakeText: 'Friday',
    paused: true,
  })
  const resumed = scheduleSheetSave(store, id, { paused: false }, viewer)
  expect(resumed.schedule.paused).toBe(false)
  expect(resumed.schedule.wakeText).toBe('Friday')
  expect(scheduleSheetDelete(store, id, viewer)).toEqual({ ok: true })
})

it('does not inject a Card for a failed tool or a catalog name', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const cards = new ChatCardTurn()
  const failed = invokeChatMcpTool({
    name: 'dostigus_schedules_create',
    args: {
      botId: bot.id,
      cadence: 'daily',
      timeLocal: '99:99',
      wakeText: 'Nope',
    },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(failed.ok).toBe(false)
  expect(cards.parts()).toEqual([])
  noteToolCard(cards, 'dostigus_modules_apply', { applied: true, id: 'weather', title: 'Weather' })
  noteToolCard(cards, 'dostigus_modules_catalog', { miss: true })
  expect(cards.parts()).toEqual([])
})

function systemLines(store: ReturnType<typeof openStore>, botId: string, personId: string): string[] {
  return listBotThreadMessages(store, botId, personId)
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
}

it('appends one system line per Skill upsert or delete and no Card', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const cards = new ChatCardTurn()
  const upserted = invokeChatMcpTool({
    name: 'dostigus_skills_upsert',
    args: {
      botId: bot.id,
      id: 'notes',
      instructions: 'Keep short notes.\nSecond line stays off the line.',
    },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(upserted.ok).toBe(true)
  expect(cards.parts()).toEqual([])
  expect(systemLines(store, bot.id, owner.id)).toEqual(['Skill · notes · Keep short notes.'])

  const again = invokeChatMcpTool({
    name: 'dostigus_skills_upsert',
    args: { botId: bot.id, id: 'notes', instructions: 'Shorter.' },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(again.ok).toBe(true)
  expect(cards.parts()).toEqual([])
  expect(systemLines(store, bot.id, owner.id)).toEqual([
    'Skill · notes · Keep short notes.',
    'Skill · notes · Shorter.',
  ])

  const listed = invokeChatMcpTool({
    name: 'dostigus_skills_list',
    args: { botId: bot.id },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(listed.ok).toBe(true)
  expect(systemLines(store, bot.id, owner.id)).toHaveLength(2)

  const removed = invokeChatMcpTool({
    name: 'dostigus_skills_delete',
    args: { botId: bot.id, id: 'notes' },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(removed.ok).toBe(true)
  expect(cards.parts()).toEqual([])
  expect(systemLines(store, bot.id, owner.id)).toEqual([
    'Skill · notes · Keep short notes.',
    'Skill · notes · Shorter.',
    'Skill · notes · Удалено',
  ])
})

it('uses «записан» when the Skill line does not fit and skips a failed delete', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  grantBot(store, bot.id, member.id)
  const cards = new ChatCardTurn()
  const longLine = 'n'.repeat(81)
  const upserted = invokeChatMcpTool({
    name: 'dostigus_skills_upsert',
    args: { botId: bot.id, id: 'long-note', instructions: longLine },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(upserted.ok).toBe(true)
  expect(cards.parts()).toEqual([])
  expect(systemLines(store, bot.id, owner.id)).toEqual(['Skill · long-note · записан'])

  const denied = invokeChatMcpTool({
    name: 'dostigus_skills_delete',
    args: { botId: bot.id, id: 'long-note' },
    store,
    role: 'member',
    personId: member.id,
    turnBotId: bot.id,
    cards,
  })
  expect(denied.ok).toBe(false)
  expect(systemLines(store, bot.id, owner.id)).toEqual(['Skill · long-note · записан'])
  expect(systemLines(store, bot.id, member.id)).toEqual([])
  expect(listBotSkills(store, bot.id).some((skill) => skill.id === 'long-note')).toBe(true)
})

it('appends a system line when name, label, or description changes and no Card', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const cards = new ChatCardTurn()
  const renamed = invokeChatMcpTool({
    name: 'dostigus_bots_update',
    args: { id: bot.id, name: 'Field notes', label: 'учёба' },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(renamed.ok).toBe(true)
  expect(cards.parts()).toEqual([])
  expect(systemLines(store, bot.id, owner.id)).toEqual(['Бот · Field notes · учёба'])

  const described = invokeChatMcpTool({
    name: 'dostigus_bots_update',
    args: { id: bot.id, description: 'For class.' },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(described.ok).toBe(true)
  expect(cards.parts()).toEqual([])
  expect(systemLines(store, bot.id, owner.id)).toEqual([
    'Бот · Field notes · учёба',
    'Бот · Field notes · учёба',
  ])

  const cleared = invokeChatMcpTool({
    name: 'dostigus_bots_update',
    args: { id: bot.id, label: '' },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(cleared.ok).toBe(true)
  expect(systemLines(store, bot.id, owner.id).at(-1)).toBe('Бот · Field notes · обновлено')

  const beforeAvatar = systemLines(store, bot.id, owner.id).length
  const avatar = invokeChatMcpTool({
    name: 'dostigus_bots_update',
    args: { id: bot.id, avatarColor: '#1F7AE5' },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(avatar.ok).toBe(true)
  expect(systemLines(store, bot.id, owner.id)).toHaveLength(beforeAvatar)

  const listed = invokeChatMcpTool({
    name: 'dostigus_bots_list',
    args: {},
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(listed.ok).toBe(true)
  const got = invokeChatMcpTool({
    name: 'dostigus_bots_get',
    args: { id: bot.id },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(got.ok).toBe(true)
  expect(cards.parts()).toEqual([])
  expect(systemLines(store, bot.id, owner.id)).toHaveLength(beforeAvatar)

  const longName = 'N'.repeat(90)
  const longLabel = 'L'.repeat(90)
  const wide = invokeChatMcpTool({
    name: 'dostigus_bots_update',
    args: { id: bot.id, name: longName, label: longLabel },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    cards,
  })
  expect(wide.ok).toBe(true)
  expect(systemLines(store, bot.id, owner.id).at(-1)).toBe(`Бот · ${longName} · обновлено`)
})

it('requires cadence and timeLocal for intent set', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const listed = invokeChatMcpTool({
    name: 'dostigus_schedules_list',
    args: { botId: bot.id, intent: 'set' },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
  })
  expect(listed.ok).toBe(false)
  expect(JSON.parse(listed.content).error).toContain('cadence')
})
