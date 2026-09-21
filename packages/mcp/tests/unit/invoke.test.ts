import { openStore } from '@dostigus/db'
import { botGreetingContent, DEFAULT_BOT_NAME, DEFAULT_MODEL_TIER } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import { invokePlatformTool, listPlatformTools, McpInvokeError, PLATFORM_TOOL_NAMES } from '../../src/index'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryCtx() {
  const store = openStore('file::memory:')
  opened.push(store)
  return { store }
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('lists the day-1 platform tools', () => {
  expect(listPlatformTools().map((tool) => tool.name)).toEqual([...PLATFORM_TOOL_NAMES])
  for (const tool of listPlatformTools()) {
    expect(tool.jsonSchema).toMatchObject({ type: 'object' })
    expect(tool.description.length).toBeGreaterThan(0)
  }
})

it('creates, lists, gets, updates, and deletes a Bot through the MCP surface', async () => {
  const ctx = memoryCtx()

  const created = await invokePlatformTool('bots.create', { name: 'Notes' }, ctx)
  expect(created.bot.name).toBe('Notes')
  expect(created.bot.manifest.modelTier).toBe(DEFAULT_MODEL_TIER)
  expect(created.greeting.content).toBe(botGreetingContent('Notes'))

  const listed = await invokePlatformTool('bots.list', {}, ctx)
  expect(listed.bots.map((bot) => bot.name)).toEqual(['Notes'])

  const got = await invokePlatformTool('bots.get', { id: created.bot.id }, ctx)
  expect(got.bot.id).toBe(created.bot.id)

  const updated = await invokePlatformTool(
    'bots.update',
    { id: created.bot.id, name: 'Renamed', modelTier: 'cheap' },
    ctx,
  )
  expect(updated.bot.name).toBe('Renamed')
  expect(updated.bot.manifest.modelTier).toBe('cheap')

  const deleted = await invokePlatformTool('bots.delete', { id: created.bot.id }, ctx)
  expect(deleted).toEqual({ ok: true })
  expect((await invokePlatformTool('bots.list', {}, ctx)).bots).toEqual([])
})

it('defaults bots.create to New Bot and strong Model tier', async () => {
  const ctx = memoryCtx()
  const created = await invokePlatformTool('bots.create', {}, ctx)
  expect(created.bot.name).toBe(DEFAULT_BOT_NAME)
  expect(created.bot.manifest.modelTier).toBe(DEFAULT_MODEL_TIER)
})

it('appends Chat messages and lists them after the greeting', async () => {
  const ctx = memoryCtx()
  const { bot } = await invokePlatformTool('bots.create', { name: 'Chat Bot' }, ctx)

  const user = await invokePlatformTool('messages.create', {
    botId: bot.id,
    role: 'user',
    content: 'Remember this later',
  }, ctx)
  expect(user.message.role).toBe('user')

  const assistant = await invokePlatformTool('messages.create', {
    botId: bot.id,
    role: 'assistant',
    content: 'Stored.',
  }, ctx)
  expect(assistant.message.role).toBe('assistant')

  const listed = await invokePlatformTool('messages.list', { botId: bot.id }, ctx)
  expect(listed.messages.map((message) => message.content)).toEqual([
    botGreetingContent('Chat Bot'),
    'Remember this later',
    'Stored.',
  ])
})

it('messages.list writes a greeting when the Chat is empty', async () => {
  const ctx = memoryCtx()
  const { bot } = await invokePlatformTool('bots.create', { name: 'Empty-open' }, ctx)
  ctx.store.sqlite.prepare('DELETE FROM messages WHERE bot_id = ?').run(bot.id)

  const listed = await invokePlatformTool('messages.list', { botId: bot.id }, ctx)
  expect(listed.messages).toHaveLength(1)
  expect(listed.messages[0]?.content).toBe(botGreetingContent('Empty-open'))
})

it('rejects an unknown tool name', async () => {
  const ctx = memoryCtx()
  await expect(invokePlatformTool('sheets.open', {}, ctx)).rejects.toMatchObject({
    name: 'McpInvokeError',
    code: 'unknown_tool',
    statusCode: 404,
  })
})

it('rejects invalid messages.create input', async () => {
  const ctx = memoryCtx()
  await expect(invokePlatformTool('messages.create', {
    botId: 'x',
    role: 'narrator',
    content: 'nope',
  }, ctx)).rejects.toBeInstanceOf(McpInvokeError)
})

it('maps a missing Bot to a not_found invoke error', async () => {
  const ctx = memoryCtx()
  await expect(invokePlatformTool('bots.get', { id: 'missing' }, ctx)).rejects.toMatchObject({
    code: 'not_found',
    statusCode: 404,
    message: 'Bot not found',
  })
})
