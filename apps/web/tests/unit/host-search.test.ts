import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { hostSearchHits, hostSearchShortcutIndex, hostSettingsCatalog } from '../../app/utils/host-search'

const bots = [
  { id: 'a', name: 'Notes', lastMessage: { content: 'Buy oat milk' } },
  { id: 'b', name: 'Meal', lastMessage: null },
]

it('lists Bots with shortcuts until the query narrows the Sheet', () => {
  const open = hostSearchHits({
    query: ' ',
    bots,
    messages: [],
    settings: hostSettingsCatalog({ isOwner: true, bot: { id: 'a', name: 'Notes' } }),
  })
  expect(open.map((hit) => hit.title)).toEqual(['Notes', 'Meal'])
  expect(open.map((hit) => hit.shortcut)).toEqual(['⌘1', '⌘2'])
  expect(open.every((hit) => hit.kind === 'bot')).toBe(true)

  const named = hostSearchHits({
    query: 'meal',
    bots,
    messages: [{ id: 'm1', botId: 'a', botName: 'Notes', content: 'Meal plan is Thursday' }],
    settings: hostSettingsCatalog({ isOwner: true, bot: { id: 'a', name: 'Notes' } }),
  })
  expect(named.map((hit) => `${hit.kind}:${hit.title}`)).toEqual([
    'bot:Meal',
    'message:Notes',
  ])
  expect(named.every((hit) => hit.shortcut == null)).toBe(true)
})

it('matches Chat lines and Host settings without opening Owner pages for a Member', () => {
  const settings = hostSettingsCatalog({ isOwner: false, bot: { id: 'a', name: 'Notes' } })
  expect(settings.map((entry) => entry.id)).toEqual(['bot-settings'])
  const hits = hostSearchHits({
    query: 'appearance',
    bots,
    messages: [],
    settings,
  })
  expect(hits.map((hit) => hit.kind)).toEqual(['settings'])
  expect(hits[0]?.botId).toBe('a')
  expect(hits[0]?.href).toBeNull()

  const owner = hostSearchHits({
    query: 'openrouter',
    bots,
    messages: [],
    settings: hostSettingsCatalog({ isOwner: true, bot: null }),
  })
  expect(owner.map((hit) => hit.href)).toEqual(['/settings/providers'])
  const allowlist = hostSearchHits({
    query: 'allowlist',
    bots,
    messages: [],
    settings: hostSettingsCatalog({ isOwner: true, bot: null }),
  })
  expect(allowlist.map((hit) => hit.href)).toEqual(['/settings/other'])
  expect(hostSearchShortcutIndex('1')).toBe(0)
  expect(hostSearchShortcutIndex('9')).toBe(8)
  expect(hostSearchShortcutIndex('0')).toBeNull()
})

it('keeps the search Sheet on the Kit dialog and the messages route', () => {
  const webRoot = join(import.meta.dirname, '../..')
  const sheet = readFileSync(join(webRoot, 'app/components/HostSearch.vue'), 'utf8')
  const route = readFileSync(join(webRoot, 'server/api/search/messages.get.ts'), 'utf8')
  expect(sheet).toContain('KitDialog')
  expect(sheet).toContain('Поиск')
  expect(sheet).toContain('chrome="bare"')
  expect(sheet).toContain('placeholder="Поиск"')
  expect(sheet).not.toContain('search-title')
  expect(sheet).not.toContain('#title')
  expect(sheet).toContain('hostSearchHits')
  const shell = readFileSync(join(webRoot, '../../packages/ui-kit/src/components/SheetShell.vue'), 'utf8')
  expect(shell).toContain('chrome !== \'bare\'')
  expect(shell).toContain('kit-sr-only')
  expect(sheet).toContain('requestOpen')
  expect(route).toContain('searchMessages')
  expect(route).toContain('requireHostSession')
  expect(route).toContain('viewerFromUser')
})
