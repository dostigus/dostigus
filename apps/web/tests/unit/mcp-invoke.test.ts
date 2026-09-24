import { createMember, createOwner, grantBot, openStore } from '@dostigus/db'
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

it('invokes Chat MCP tools against the same Store helpers', () => {
  const store = memoryStore()
  const created = invokeChatMcpTool({
    name: 'dostigus_bots_create',
    args: { name: 'Notes' },
    store,
  })
  expect(created.ok).toBe(true)
  const createdBody = JSON.parse(created.content) as { bot: { id: string, name: string } }
  expect(createdBody.bot.name).toBe('Notes')

  const renamed = invokeChatMcpTool({
    name: 'dostigus_bots_update',
    args: JSON.stringify({ id: createdBody.bot.id, name: 'Renamed' }),
    store,
  })
  expect(renamed.ok).toBe(true)
  expect(JSON.parse(renamed.content)).toMatchObject({
    bot: { id: createdBody.bot.id, name: 'Renamed' },
  })

  const listed = invokeChatMcpTool({
    name: 'dostigus_bots_list',
    args: '{}',
    store,
  })
  expect(listed.ok).toBe(true)
  expect(JSON.parse(listed.content)).toMatchObject({
    bots: [{ id: createdBody.bot.id, name: 'Renamed' }],
  })
})

it('returns error content when a Chat tool fails', () => {
  const store = memoryStore()
  const missing = invokeChatMcpTool({
    name: 'dostigus_bots_get',
    args: { id: 'missing' },
    store,
  })
  expect(missing.ok).toBe(false)
  expect(JSON.parse(missing.content)).toEqual({ error: 'Bot not found' })

  const badArgs = invokeChatMcpTool({
    name: 'dostigus_bots_get',
    args: {},
    store,
  })
  expect(badArgs.ok).toBe(false)
  expect(JSON.parse(badArgs.content)).toEqual({ error: 'invalid tool arguments' })
})

it('refuses delete and unknown tools without writing the Store', () => {
  const store = memoryStore()
  const created = invokeChatMcpTool({
    name: 'dostigus_bots_create',
    args: { name: 'Keep me' },
    store,
  })
  const id = (JSON.parse(created.content) as { bot: { id: string } }).bot.id

  const deleted = invokeChatMcpTool({
    name: 'dostigus_bots_delete',
    args: { id },
    store,
  })
  expect(deleted.ok).toBe(false)
  expect(JSON.parse(deleted.content)).toEqual({ error: 'unknown or unavailable tool' })

  const unknown = invokeChatMcpTool({
    name: 'not_a_platform_tool',
    args: {},
    store,
  })
  expect(unknown.ok).toBe(false)
  expect(JSON.parse(unknown.content)).toEqual({ error: 'unknown or unavailable tool' })

  const listed = invokeChatMcpTool({
    name: 'dostigus_bots_list',
    args: {},
    store,
  })
  expect(JSON.parse(listed.content)).toMatchObject({
    bots: [{ id, name: 'Keep me' }],
  })
})

it('attributes Member Chat messages and refuses Bot tools', () => {
  const store = memoryStore()
  const created = invokeChatMcpTool({
    name: 'dostigus_bots_create',
    args: { name: 'Notes' },
    store,
  })
  const botId = (JSON.parse(created.content) as { bot: { id: string } }).bot.id
  store.sqlite.prepare('UPDATE bots SET created_by = ? WHERE id = ?').run('member-1', botId)

  const blocked = invokeChatMcpTool({
    name: 'dostigus_bots_create',
    args: { name: 'Nope' },
    store,
    role: 'member',
    personId: 'member-1',
  })
  expect(blocked.ok).toBe(false)
  expect(JSON.parse(blocked.content)).toEqual({ error: 'unknown or unavailable tool' })

  const listed = invokeChatMcpTool({
    name: 'dostigus_bots_list',
    args: {},
    store,
    role: 'member',
  })
  expect(listed.ok).toBe(false)

  const message = invokeChatMcpTool({
    name: 'dostigus_messages_create',
    args: { botId, content: 'Hello from Ada' },
    store,
    role: 'member',
    personId: 'member-1',
  })
  expect(message.ok).toBe(true)
  expect(JSON.parse(message.content)).toMatchObject({
    message: { personId: 'member-1', role: 'user', content: 'Hello from Ada' },
  })

  const assistant = invokeChatMcpTool({
    name: 'dostigus_messages_create',
    args: { botId, content: 'Noted', role: 'assistant' },
    store,
    role: 'member',
    personId: 'member-1',
  })
  expect(JSON.parse(assistant.content)).toMatchObject({
    message: { personId: null, role: 'assistant' },
  })
})

it('rejects an empty rename from Chat and persists a real name', () => {
  const store = memoryStore()
  const created = invokeChatMcpTool({
    name: 'dostigus_bots_create',
    args: { name: 'Notes' },
    store,
  })
  const botId = (JSON.parse(created.content) as { bot: { id: string } }).bot.id

  const empty = invokeChatMcpTool({
    name: 'dostigus_bots_update',
    args: { id: botId, name: '   ' },
    store,
  })
  expect(empty.ok).toBe(false)
  expect(JSON.parse(empty.content)).toEqual({ error: 'Bot name is required' })

  const renamed = invokeChatMcpTool({
    name: 'dostigus_bots_update',
    args: { id: botId, name: 'Дождевик' },
    store,
  })
  expect(renamed.ok).toBe(true)
  expect(JSON.parse(renamed.content)).toMatchObject({
    bot: { id: botId, name: 'Дождевик' },
  })
})

it('lets the creator Member update and edit Skills, and refuses a grantee', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const creator = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const grantee = createMember(store, {
    displayName: 'Lin',
    username: 'lin',
    passwordHash: 'hash:lin',
  })
  const created = invokeChatMcpTool({
    name: 'dostigus_bots_create',
    args: { name: 'Notes' },
    store,
    role: 'owner',
    personId: owner.id,
  })
  const botId = (JSON.parse(created.content) as { bot: { id: string } }).bot.id
  store.sqlite.prepare('UPDATE bots SET created_by = ? WHERE id = ?').run(creator.id, botId)
  grantBot(store, botId, grantee.id)

  const renamed = invokeChatMcpTool({
    name: 'dostigus_bots_update',
    args: { id: botId, name: 'Дождевик' },
    store,
    role: 'member',
    personId: creator.id,
  })
  expect(renamed.ok).toBe(true)
  expect(JSON.parse(renamed.content)).toMatchObject({ bot: { name: 'Дождевик' } })

  const upserted = invokeChatMcpTool({
    name: 'dostigus_skills_upsert',
    args: { botId, id: 'notes', instructions: 'Keep short notes.' },
    store,
    role: 'member',
    personId: creator.id,
  })
  expect(upserted.ok).toBe(true)
  expect(JSON.parse(upserted.content)).toMatchObject({
    skills: [{ id: 'notes', instructions: 'Keep short notes.' }],
  })

  const listed = invokeChatMcpTool({
    name: 'dostigus_skills_list',
    args: { botId },
    store,
    role: 'owner',
    personId: owner.id,
  })
  expect(listed.ok).toBe(true)

  const blockedUpdate = invokeChatMcpTool({
    name: 'dostigus_bots_update',
    args: { id: botId, name: 'Stolen' },
    store,
    role: 'member',
    personId: grantee.id,
  })
  expect(blockedUpdate.ok).toBe(false)
  expect(JSON.parse(blockedUpdate.content).error).toMatch(/Only the Owner can change this/)

  const blockedSkill = invokeChatMcpTool({
    name: 'dostigus_skills_delete',
    args: { botId, id: 'notes' },
    store,
    role: 'member',
    personId: grantee.id,
  })
  expect(blockedSkill.ok).toBe(false)

  const removed = invokeChatMcpTool({
    name: 'dostigus_skills_delete',
    args: { botId, id: 'notes' },
    store,
    role: 'owner',
    personId: owner.id,
  })
  expect(removed.ok).toBe(true)
  expect(JSON.parse(removed.content)).toMatchObject({ skills: [] })

  const still = invokeChatMcpTool({
    name: 'dostigus_bots_get',
    args: { id: botId },
    store,
    role: 'owner',
    personId: owner.id,
  })
  expect(JSON.parse(still.content)).toMatchObject({ bot: { name: 'Дождевик' } })
})
