import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listBots, listMessages, openStore } from '@dostigus/db'
import { DEFAULT_BOT_NAME } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import { OwnerAuthError, registerClusterOwner } from '../../server/utils/owner-auth'
import {
  ensurePreviewCluster,
  PREVIEW_OWNER_LOGIN,
  PREVIEW_OWNER_PASSWORD,
  previewSeedAllowed,
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
  expect(src).toContain('statusCode: 404')
  expect(src).toContain('startOwnerSession')
  expect(src).toContain('sendRedirect')
  expect(src).not.toContain('requireOwnerSession')
  expect(src).not.toContain('requireHostSession')
  expect(src).not.toContain('requireUserSession')
  expect(PREVIEW_OWNER_PASSWORD.length).toBeGreaterThanOrEqual(8)
})
