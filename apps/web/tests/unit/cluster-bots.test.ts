import { openStore, StoreError } from '@dostigus/db'
import { botGreetingContent, DEFAULT_BOT_NAME } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import {
  appendClusterMessage,
  createClusterBot,
  deleteClusterBot,
  getClusterBot,
  listClusterBots,
  listClusterMessages,
  updateClusterBot,
} from '../../server/utils/cluster-bots'

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

it('lists, gets, updates, and deletes Bots through the shared Store helpers', () => {
  const store = memoryStore()
  const { bot, greeting } = createClusterBot(store, { name: 'Notes' })

  expect(bot.name).toBe('Notes')
  expect(greeting.content).toBe(botGreetingContent('Notes'))
  expect(listClusterBots(store).bots.map((item) => item.name)).toEqual(['Notes'])
  expect(getClusterBot(store, bot.id).bot.id).toBe(bot.id)

  const updated = updateClusterBot(store, bot.id, { name: 'Renamed', modelTier: 'cheap' })
  expect(updated.bot.name).toBe('Renamed')
  expect(updated.bot.manifest.modelTier).toBe('cheap')

  expect(deleteClusterBot(store, bot.id)).toEqual({ ok: true })
  expect(listClusterBots(store).bots).toEqual([])
  expect(() => getClusterBot(store, bot.id)).toThrow(StoreError)
})

it('defaults a created Bot name and appends Chat messages', () => {
  const store = memoryStore()
  const { bot } = createClusterBot(store)
  expect(bot.name).toBe(DEFAULT_BOT_NAME)

  const listed = listClusterMessages(store, bot.id)
  expect(listed.messages).toHaveLength(1)

  const user = appendClusterMessage(store, {
    botId: bot.id,
    role: 'user',
    content: 'Remember this later',
  })
  expect(user.role).toBe('user')
  expect(listClusterMessages(store, bot.id).messages.map((message) => message.content)).toEqual([
    botGreetingContent(DEFAULT_BOT_NAME),
    'Remember this later',
  ])
})

it('rejects an unknown Bot for messages', () => {
  const store = memoryStore()
  expect(() => listClusterMessages(store, 'missing')).toThrow(StoreError)
})
