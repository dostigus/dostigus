import { openStore } from '@dostigus/db'
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
