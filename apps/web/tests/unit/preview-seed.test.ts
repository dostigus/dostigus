import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createBot, listBots, listMessages, openStore, updateBot } from '@dostigus/db'
import { DEFAULT_BOT_NAME } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import { OwnerAuthError, registerClusterOwner } from '../../server/utils/owner-auth'
import {
  ensurePreviewCluster,
  PREVIEW_BOT_ID,
  PREVIEW_OWNER_LOGIN,
  PREVIEW_OWNER_PASSWORD,
  PREVIEW_TALL_LINE_COUNT,
  PREVIEW_TALL_PREFIX,
  previewMembersRequested,
  previewSeedAllowed,
  previewTallRequested,
  readPreviewSeedHead,
  stablePreviewBotId,
} from '../../server/utils/preview-seed'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

async function hashPassword(password: string) {
  return `hash:${password}`
}

async function verifyPassword(hash: string, password: string) {
  return hash === `hash:${password}`
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('allows the preview seed only for nuxt dev with the flag set to 1', () => {
  expect(previewSeedAllowed({ dev: true, flag: '1' })).toBe(true)
  expect(previewSeedAllowed({ dev: true, flag: undefined })).toBe(false)
  expect(previewSeedAllowed({ dev: true, flag: 'true' })).toBe(false)
  expect(previewSeedAllowed({ dev: true, flag: '0' })).toBe(false)
  expect(previewSeedAllowed({ dev: false, flag: '1' })).toBe(false)
})

it('creates the preview Owner, one Bot, and a greeting, then reuses them', async () => {
  const store = memoryStore()
  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  expect(first.user.role).toBe('owner')
  expect(first.user.username).toBe(PREVIEW_OWNER_LOGIN)
  expect(first.botId).toBe(PREVIEW_BOT_ID)
  const second = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  expect(second.user.id).toBe(first.user.id)
  expect(second.botId).toBe(first.botId)
  const bots = listBots(store)
  expect(bots).toHaveLength(1)
  expect(bots[0]?.name).toBe(DEFAULT_BOT_NAME)
  const messages = listMessages(store, first.botId)
  expect(messages).toHaveLength(1)
  expect(messages[0]?.role).toBe('assistant')
  expect(messages[0]?.content).toContain(DEFAULT_BOT_NAME)
})

it('refuses a Store whose Owner is not the preview login', async () => {
  const store = memoryStore()
  await registerClusterOwner(store, {
    login: 'ada',
    password: 'secret-pass',
  }, hashPassword)
  await expect(ensurePreviewCluster(store, hashPassword, verifyPassword))
    .rejects
    .toBeInstanceOf(OwnerAuthError)
})

it('keeps the preview seed route closed unless the gate allows it', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../server/routes/preview-seed.get.ts'),
    'utf8',
  )
  expect(src).toContain('previewSeedAllowed')
  expect(src).toContain('previewTallRequested')
  expect(src).toContain('previewMembersRequested')
  expect(src).toContain('\'/members\'')
  expect(src).toContain('previewChatLocation')
  expect(src).toContain('statusCode: 404')
  expect(src).toContain('startOwnerSession')
  expect(src).toContain('sendRedirect')
  expect(src).toContain('PREVIEW_SEED_OWNER_CONFLICT')
  expect(src).not.toContain('requireOwnerSession')
  expect(src).not.toContain('requireHostSession')
  expect(src).not.toContain('requireUserSession')
  expect(PREVIEW_OWNER_PASSWORD.length).toBeGreaterThanOrEqual(8)
})

it('answers HEAD without signing in or writing the Store', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../server/routes/preview-seed.head.ts'),
    'utf8',
  )
  expect(src).toContain('previewSeedAllowed')
  expect(src).toContain('readPreviewSeedHead')
  expect(src).toContain('setResponseStatus(event, 404')
  expect(src).toContain('setResponseStatus(event, 204)')
  expect(src).not.toContain('startOwnerSession')
  expect(src).not.toContain('ensurePreviewCluster')
  expect(src).not.toContain('previewChatLocation')
  expect(src).not.toContain('previewMembersRequested')
  expect(src).not.toContain('/members')
  expect(src).not.toContain('requireOwnerSession')
  expect(src).not.toContain('requireHostSession')
  expect(src).not.toContain('requireUserSession')
})

it('treats tall=1 as the layout-thread query', () => {
  expect(previewTallRequested('1')).toBe(true)
  expect(previewTallRequested(1)).toBe(true)
  expect(previewTallRequested(['1'])).toBe(true)
  expect(previewTallRequested(undefined)).toBe(false)
  expect(previewTallRequested('true')).toBe(false)
  expect(previewTallRequested('0')).toBe(false)
})

it('treats members=1 as the Members landing query', () => {
  expect(previewMembersRequested('1')).toBe(true)
  expect(previewMembersRequested(1)).toBe(true)
  expect(previewMembersRequested(['1'])).toBe(true)
  expect(previewMembersRequested(undefined)).toBe(false)
  expect(previewMembersRequested('true')).toBe(false)
  expect(previewMembersRequested('0')).toBe(false)
})

it('turns Nuxt devtools off only while the preview seed flag is set', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../nuxt.config.ts'),
    'utf8',
  )
  expect(src).toContain('DOSTIGUS_PREVIEW_SEED === \'1\'')
  expect(src).toContain('devtools:')
  expect(src).toContain('enabled: false')
  expect(src).toContain('nuxt-devtools-frame')
})

it('does not look up the preview Bot by display name', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../server/utils/preview-seed.ts'),
    'utf8',
  )
  expect(src).toContain('export const PREVIEW_BOT_ID = \'preview\'')
  expect(src).toContain('id: PREVIEW_BOT_ID')
  expect(src).not.toMatch(/\.name\s*[!=]==?\s*DEFAULT_BOT_NAME/)
})

it('selects the fixture Bot id and ignores display name', () => {
  expect(PREVIEW_BOT_ID).toBe('preview')
  expect(stablePreviewBotId([
    { id: 'newer', name: DEFAULT_BOT_NAME },
    { id: PREVIEW_BOT_ID, name: 'Шеф' },
    { id: 'older', name: DEFAULT_BOT_NAME },
  ] as Array<{ id: string }>)).toBe(PREVIEW_BOT_ID)
  expect(stablePreviewBotId([
    { id: 'older', name: DEFAULT_BOT_NAME },
    { id: 'newer', name: DEFAULT_BOT_NAME },
  ] as Array<{ id: string }>)).toBeNull()
})

it('keeps the fixture Bot when a newer Bot is added', async () => {
  const store = memoryStore()
  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  const pantry = createBot(store, { name: 'Pantry' })
  const again = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  expect(again.botId).toBe(PREVIEW_BOT_ID)
  expect(again.botId).toBe(first.botId)
  expect(again.botId).not.toBe(pantry.bot.id)
  expect(listBots(store)).toHaveLength(2)
})

it('keeps the fixture Bot after its name changes', async () => {
  const store = memoryStore()
  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  updateBot(store, first.botId, { name: 'Шеф' })
  const decoy = createBot(store, { name: DEFAULT_BOT_NAME })
  const again = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  expect(again.botId).toBe(PREVIEW_BOT_ID)
  expect(again.botId).not.toBe(decoy.bot.id)
  expect(listBots(store)).toHaveLength(2)
  expect(listBots(store).find((bot) => bot.id === PREVIEW_BOT_ID)?.name).toBe('Шеф')
  expect(readPreviewSeedHead(store)).toEqual({
    statusCode: 302,
    location: `/bots/${PREVIEW_BOT_ID}`,
  })
})

it('creates the fixture Bot when the Store only has another New Bot', async () => {
  const store = memoryStore()
  await registerClusterOwner(store, {
    login: PREVIEW_OWNER_LOGIN,
    password: PREVIEW_OWNER_PASSWORD,
  }, hashPassword)
  const named = createBot(store, { name: DEFAULT_BOT_NAME })
  expect(readPreviewSeedHead(store)).toEqual({ statusCode: 204 })
  const seeded = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  expect(seeded.botId).toBe(PREVIEW_BOT_ID)
  expect(seeded.botId).not.toBe(named.bot.id)
  expect(listBots(store).find((bot) => bot.id === seeded.botId)?.name).toBe(DEFAULT_BOT_NAME)
  expect(listMessages(store, named.bot.id)).toHaveLength(1)
  expect(listBots(store)).toHaveLength(2)
})

it('fills a tall thread once on the stable Bot', async () => {
  const store = memoryStore()
  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword, { tall: true })
  const pantry = createBot(store, { name: 'Pantry' })
  const messages = listMessages(store, first.botId)
  expect(messages).toHaveLength(1 + PREVIEW_TALL_LINE_COUNT)
  expect(messages[0]?.role).toBe('assistant')
  expect(messages[0]?.content).toContain(DEFAULT_BOT_NAME)
  expect(messages[1]?.content).toBe(`${PREVIEW_TALL_PREFIX}1.`)
  expect(messages[1]?.role).toBe('user')
  expect(messages[1]?.personId).toBe(first.user.id)
  expect(messages.at(-1)?.content.startsWith(`${PREVIEW_TALL_PREFIX}${PREVIEW_TALL_LINE_COUNT}.`)).toBe(true)
  for (let index = 1; index < messages.length; index++) {
    expect(Date.parse(messages[index]!.createdAt)).toBeGreaterThan(Date.parse(messages[index - 1]!.createdAt))
  }
  for (const message of messages) {
    if (message.role === 'user') {
      expect(message.personId).toBe(first.user.id)
    } else {
      expect(message.personId).toBeNull()
    }
  }
  const second = await ensurePreviewCluster(store, hashPassword, verifyPassword, { tall: true })
  expect(second.botId).toBe(first.botId)
  expect(listMessages(store, first.botId)).toHaveLength(messages.length)
  expect(listMessages(store, pantry.bot.id)).toHaveLength(1)
})

it('reads HEAD from the Store without writing', async () => {
  const empty = memoryStore()
  expect(readPreviewSeedHead(empty)).toEqual({ statusCode: 204 })

  const store = memoryStore()
  const seeded = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  const before = listMessages(store, seeded.botId).length
  expect(readPreviewSeedHead(store)).toEqual({
    statusCode: 302,
    location: `/bots/${seeded.botId}`,
  })
  createBot(store, { name: 'Pantry' })
  expect(readPreviewSeedHead(store).location).toBe(`/bots/${seeded.botId}`)
  expect(listMessages(store, seeded.botId)).toHaveLength(before)

  const other = memoryStore()
  await registerClusterOwner(other, { login: 'ada', password: 'secret-pass' }, hashPassword)
  expect(readPreviewSeedHead(other)).toEqual({ statusCode: 409 })
  expect(listBots(other)).toHaveLength(0)
})
