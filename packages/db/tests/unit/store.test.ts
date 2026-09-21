import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { botGreetingContent, DEFAULT_BOT_NAME, DEFAULT_MODEL_TIER } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import {
  createBot,
  deleteBot,
  ensureGreeting,
  insertMessage,
  listBots,
  listMessages,
  openStore,
  StoreError,
  storeFilePath,
  updateBot,
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

  const names = listBots(store).map((bot) => bot.name)
  expect(names).toEqual(['Beta', 'Alpha'])
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

it('updates name and Model tier, and cascade-deletes messages', () => {
  const store = memoryStore()
  const { bot } = createBot(store, { name: 'Temp' })
  insertMessage(store, { botId: bot.id, role: 'user', content: 'hi' })

  const updated = updateBot(store, bot.id, { name: 'Renamed', modelTier: 'code' })
  expect(updated.name).toBe('Renamed')
  expect(updated.manifest.modelTier).toBe('code')
  expect(updated.manifest.name).toBe('Renamed')

  deleteBot(store, bot.id)
  expect(listBots(store)).toEqual([])
  expect(() => listMessages(store, bot.id)).toThrow(StoreError)
  const leftover = store.sqlite.prepare(
    'SELECT count(*) AS n FROM messages',
  ).get() as { n: number }
  expect(leftover.n).toBe(0)
})

it('rejects an unknown Model tier', () => {
  const store = memoryStore()
  expect(() => createBot(store, { modelTier: 'smart' })).toThrow(/Model tier/)
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
