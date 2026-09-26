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
  META_SKILL_IDS,
  openStore,
  searchMessages,
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
    label: '',
    description: '',
    skillIds: [...META_SKILL_IDS],
    modulePackageIds: [],
  })
  expect(greeting.role).toBe('assistant')
  expect(greeting.content).toBe(botGreetingContent(DEFAULT_BOT_NAME))
  expect(greeting.parts).toEqual([])
  expect(listMessages(store, bot.id)).toHaveLength(1)
})

it('stores a caller-supplied Bot id and rejects a duplicate or an invalid id', () => {
  const store = memoryStore()
  const fixture = createBot(store, { id: 'preview', name: DEFAULT_BOT_NAME })
  expect(fixture.bot.id).toBe('preview')
  expect(fixture.greeting.content).toBe(botGreetingContent(DEFAULT_BOT_NAME))
  expect(() => createBot(store, { id: 'preview' })).toThrow(/Bot id already exists/)
  expect(() => createBot(store, { id: 'not a bot' })).toThrow(/Bot id/)
  expect(() => createBot(store, { id: '' })).toThrow(/Bot id/)
  expect(createBot(store).bot.id).not.toBe('preview')
})

it('allows more than one Bot named New Bot', () => {
  const store = memoryStore()
  const first = createBot(store)
  const second = createBot(store, {
    name: DEFAULT_BOT_NAME,
    avatarShape: 'owl',
    avatarColor: '#DE3957',
  })
  expect(first.bot.id).not.toBe(second.bot.id)
  expect(second.bot.name).toBe(DEFAULT_BOT_NAME)
  expect(second.bot.manifest.avatarShape).toBe('owl')
  expect(second.bot.manifest.avatarColor).toBe('#DE3957')
  expect(listBots(store)).toHaveLength(2)
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

it('stores Kit parts on an assistant line and drops them everywhere else', () => {
  const store = memoryStore()
  const { bot } = createBot(store, { name: 'Notes' })
  const parts = [
    { kind: 'status' as const, label: 'Preview', tone: 'neutral' as const },
    {
      kind: 'button' as const,
      label: 'Open demo',
      action: { type: 'openSheet' as const, sheetId: 'demo' },
    },
    { kind: 'table' as const, label: 'Later' },
  ]
  const assistant = insertMessage(store, {
    botId: bot.id,
    role: 'assistant',
    content: 'Open the Sheet.',
    parts,
  })
  expect(assistant.parts).toEqual([
    { kind: 'status', label: 'Preview', tone: 'neutral' },
    { kind: 'button', label: 'Open demo', action: { type: 'openSheet', sheetId: 'demo' } },
  ])

  const user = insertMessage(store, {
    botId: bot.id,
    role: 'user',
    content: 'hi',
    parts,
  })
  expect(user.parts).toEqual([])

  const system = insertMessage(store, {
    botId: bot.id,
    role: 'system',
    content: 'note',
    parts,
  })
  expect(system.parts).toEqual([])

  store.sqlite.prepare('UPDATE messages SET parts_json = ? WHERE id = ?').run('not-json', assistant.id)
  store.sqlite.prepare('UPDATE messages SET parts_json = ? WHERE id = ?').run(
    JSON.stringify(parts),
    user.id,
  )
  const listed = listMessages(store, bot.id)
  expect(listed.find((message) => message.id === assistant.id)?.parts).toEqual([])
  expect(listed.find((message) => message.id === user.id)?.parts).toEqual([])
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

  const labeled = updateBot(store, bot.id, {
    label: 'Research',
    description: 'Keeps notes for the week',
  })
  expect(labeled.manifest.label).toBe('Research')
  expect(labeled.manifest.description).toBe('Keeps notes for the week')
  expect(labeled.manifest.modelTier).toBe('code')
  expect(updateBot(store, bot.id, { label: '  ', description: '' }).manifest.label).toBe('')
  expect(() => updateBot(store, bot.id, { name: '   ' })).toThrow(/Bot name is required/)
  expect(listBots(store)[0]?.name).toBe('Renamed')
  const trimmed = updateBot(store, bot.id, { name: '  Raincoat  ' })
  expect(trimmed.name).toBe('Raincoat')

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

it('persists Cluster LLM gateway settings without a row-level key', () => {
  const store = memoryStore()
  expect(getLlmGatewaySettings(store).providers).toEqual([])

  const saved = upsertLlmGatewaySettings(store, {
    baseUrl: 'https://openrouter.ai/api/v1/',
    defaultTier: 'cheap',
    modelOverrides: { cheap: 'openai/gpt-4.1-mini' },
  })
  expect(saved.baseUrl).toBe('https://openrouter.ai/api/v1')
  expect(saved.defaultTier).toBe('cheap')
  expect(saved.modelOverrides).toEqual({ cheap: 'openai/gpt-4.1-mini' })
  expect(saved.providers).toEqual([])
  expect(saved).not.toHaveProperty('apiKey')

  const kept = upsertLlmGatewaySettings(store, {
    defaultTier: 'strong',
  })
  expect(kept.defaultTier).toBe('strong')
  expect(kept.modelOverrides).toEqual({ cheap: 'openai/gpt-4.1-mini' })
})

it('persists Provider instances and auto-fills empty OpenRouter tiers', () => {
  const store = memoryStore()
  const saved = upsertLlmGatewaySettings(store, {
    providers: [{
      id: 'or1',
      kind: 'openrouter',
      apiKey: 'sk-or',
      baseUrl: null,
      defaultModel: null,
    }],
  })
  expect(saved.providers).toEqual([{
    id: 'or1',
    kind: 'openrouter',
    apiKey: 'sk-or',
    baseUrl: null,
    defaultModel: null,
  }])
  expect(saved.tierBinds).toEqual({
    cheap: { providerId: 'or1', policy: { kind: 'free' } },
    strong: { providerId: 'or1', policy: { kind: 'auto' } },
    code: { providerId: 'or1', policy: { kind: 'auto' } },
    toy: { providerId: 'or1', policy: { kind: 'free' } },
  })
  expect(saved).not.toHaveProperty('apiKey')

  const kept = upsertLlmGatewaySettings(store, {
    providers: [{
      id: 'or1',
      kind: 'openrouter',
      apiKey: null,
      baseUrl: null,
      defaultModel: null,
    }],
  })
  expect(kept.providers?.[0]?.apiKey).toBe('sk-or')
  expect(kept.tierBinds?.cheap).toEqual({ providerId: 'or1', policy: { kind: 'free' } })

  const pinned = upsertLlmGatewaySettings(store, {
    tierBinds: {
      ...kept.tierBinds,
      strong: { providerId: 'or1', policy: { kind: 'model', modelId: 'lab/smart' } },
    },
  })
  expect(pinned.providers?.[0]?.apiKey).toBe('sk-or')
  expect(pinned.tierBinds?.strong).toEqual({
    providerId: 'or1',
    policy: { kind: 'model', modelId: 'lab/smart' },
  })
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

it('searches Chat lines and keeps % literal', () => {
  const store = memoryStore()
  const { bot } = createBot(store, { name: 'Notes' })
  insertMessage(store, { botId: bot.id, role: 'user', content: 'Buy oat milk' })
  insertMessage(store, { botId: bot.id, role: 'user', content: '100% rye' })
  const long = `${'word '.repeat(40)}oat milk at the end`
  insertMessage(store, { botId: bot.id, role: 'user', content: long })
  expect(searchMessages(store, '')).toEqual([])
  expect(searchMessages(store, '   ')).toEqual([])
  const oat = searchMessages(store, 'OAT')
  expect(oat.map((hit) => hit.botName)).toEqual(['Notes', 'Notes'])
  expect(oat.every((hit) => hit.content.toLowerCase().includes('oat'))).toBe(true)
  expect(oat[0]?.content.length).toBeLessThan(180)
  const percent = searchMessages(store, '%')
  expect(percent).toHaveLength(1)
  expect(percent[0]?.content).toContain('100% rye')
  expect(searchMessages(store, 'missing')).toEqual([])
})
