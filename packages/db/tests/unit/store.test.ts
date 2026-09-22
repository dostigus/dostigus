import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { botGreetingContent, DEFAULT_BOT_NAME, DEFAULT_MODEL_TIER } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import {
  createBot,
  deleteBot,
  ensureGreeting,
  getLlmGatewaySettings,
  insertMessage,
  listBots,
  listMessages,
  openStore,
  StoreError,
  storeFilePath,
  updateBot,
  upsertLlmGatewaySettings,
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

it('parses file: Store URLs', () => {
  expect(storeFilePath('file:/var/lib/dostigus/cluster.sqlite')).toBe(
    '/var/lib/dostigus/cluster.sqlite',
  )
  expect(storeFilePath('file::memory:')).toBe(':memory:')
})

it('creates a Bot with default name, strong Model tier, and greeting', () => {
  const store = memoryStore()
  const { bot, greeting } = createBot(store)

  expect(bot.name).toBe(DEFAULT_BOT_NAME)
  expect(bot.manifest).toEqual({
    name: DEFAULT_BOT_NAME,
    modelTier: DEFAULT_MODEL_TIER,
    avatarShape: 'goose',
    avatarColor: '#1F7AE5',
    skillIds: [],
    modulePackageIds: [],
  })
  expect(greeting.role).toBe('assistant')
  expect(greeting.content).toBe(botGreetingContent(DEFAULT_BOT_NAME))
  expect(listMessages(store, bot.id)).toHaveLength(1)
})

it('persists Chat messages and lists Bots newest first', () => {
  const store = memoryStore()
  const older = createBot(store, { name: 'Alpha' }).bot
  const newer = createBot(store, { name: 'Beta', modelTier: 'cheap' }).bot

  const user = insertMessage(store, {
    botId: newer.id,
    role: 'user',
    content: 'Help me sort notes later',
  })
  expect(user.role).toBe('user')

  const listed = listBots(store)
  expect(listed.map((bot) => bot.name)).toEqual(['Beta', 'Alpha'])
  expect(listed.find((bot) => bot.name === 'Beta')?.lastMessage?.content).toBe('Help me sort notes later')
  expect(listed.find((bot) => bot.name === 'Alpha')?.lastMessage?.content).toBe(botGreetingContent('Alpha'))
  expect(listMessages(store, newer.id).map((message) => message.content)).toEqual([
    botGreetingContent('Beta'),
    'Help me sort notes later',
  ])
  expect(listMessages(store, older.id)).toHaveLength(1)
})

it('does not insert a second greeting on first open', () => {
  const store = memoryStore()
  const { bot } = createBot(store, { name: 'Named' })
  const first = ensureGreeting(store, bot.id)
  const second = ensureGreeting(store, bot.id)
  expect(first.id).toBe(second.id)
  expect(listMessages(store, bot.id)).toHaveLength(1)
})

it('updates name, Model tier, and avatar fields, and cascade-deletes messages', () => {
  const store = memoryStore()
  const { bot } = createBot(store, { name: 'Temp' })
  insertMessage(store, { botId: bot.id, role: 'user', content: 'hi' })

  const updated = updateBot(store, bot.id, {
    name: 'Renamed',
    modelTier: 'code',
    avatarShape: 'owl',
    avatarColor: '#0AAC7B',
  })
  expect(updated.name).toBe('Renamed')
  expect(updated.manifest.modelTier).toBe('code')
  expect(updated.manifest.name).toBe('Renamed')
  expect(updated.manifest.avatarShape).toBe('owl')
  expect(updated.manifest.avatarColor).toBe('#0AAC7B')

  deleteBot(store, bot.id)
  expect(listBots(store)).toEqual([])
  expect(() => listMessages(store, bot.id)).toThrow(StoreError)
  const leftover = store.sqlite.prepare(
    'SELECT count(*) AS n FROM messages',
  ).get() as { n: number }
  expect(leftover.n).toBe(0)
})

it('rejects an unknown avatar shape or color', () => {
  const store = memoryStore()
  expect(() => createBot(store, { avatarShape: 'square' })).toThrow(/avatar shape/)
  expect(() => createBot(store, { avatarColor: '#ffffff' })).toThrow(/avatar color/)
})

it('lists the latest Chat line as a one-line preview', () => {
  const store = memoryStore()
  const { bot } = createBot(store, { name: 'Notes' })
  insertMessage(store, {
    botId: bot.id,
    role: 'user',
    content: `  Line one\n\n${'word '.repeat(40)}`,
  })
  const preview = listBots(store)[0]?.lastMessage?.content ?? ''
  expect(preview.startsWith('Line one word')).toBe(true)
  expect(preview.endsWith('…')).toBe(true)
  expect(preview.length).toBe(140)
  expect(preview).not.toContain('\n')
})

it('rejects an unknown Model tier', () => {
  const store = memoryStore()
  expect(() => createBot(store, { modelTier: 'smart' })).toThrow(/Model tier/)
})

it('persists Cluster LLM gateway settings and keeps the key unless cleared', () => {
  const store = memoryStore()
  expect(getLlmGatewaySettings(store).apiKey).toBeNull()

  const saved = upsertLlmGatewaySettings(store, {
    baseUrl: 'https://openrouter.ai/api/v1/',
    apiKey: 'sk-store-secret',
    defaultTier: 'cheap',
    modelOverrides: { cheap: 'openai/gpt-4.1-mini' },
  })
  expect(saved.baseUrl).toBe('https://openrouter.ai/api/v1')
  expect(saved.apiKey).toBe('sk-store-secret')
  expect(saved.defaultTier).toBe('cheap')
  expect(saved.modelOverrides).toEqual({ cheap: 'openai/gpt-4.1-mini' })

  const kept = upsertLlmGatewaySettings(store, {
    defaultTier: 'strong',
  })
  expect(kept.apiKey).toBe('sk-store-secret')
  expect(kept.defaultTier).toBe('strong')

  const cleared = upsertLlmGatewaySettings(store, { clearApiKey: true })
  expect(cleared.apiKey).toBeNull()
})

it('rejects a non-http LLM gateway base URL', () => {
  const store = memoryStore()
  expect(() => upsertLlmGatewaySettings(store, {
    baseUrl: 'ftp://example.test',
  })).toThrow(/http/)
})

it('writes a SQLite file on a volume-like path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dostigus-store-'))
  const url = `file:${join(dir, 'cluster.sqlite')}`
  const store = openStore(url)
  opened.push(store)
  createBot(store, { name: 'On disk' })
  store.close()

  const reopened = openStore(url)
  opened.push(reopened)
  expect(listBots(reopened).map((bot) => bot.name)).toEqual(['On disk'])
  rmSync(dir, { recursive: true, force: true })
})
