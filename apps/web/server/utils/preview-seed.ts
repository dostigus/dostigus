import type { OpenedStore } from '@dostigus/db'
import type { HostSessionUser } from './owner-auth'
import { createBot, findOwnerSecretByLogin, insertMessage, listBots, listMessages, ownerExists } from '@dostigus/db'
import { DEFAULT_BOT_NAME } from '@dostigus/shared'
import {
  loginHostAccount,
  OwnerAuthError,
  registerClusterOwner,
  toOwnerSession,
} from './owner-auth'

/** Local preview Owner. Created only when the preview seed route runs. */
export const PREVIEW_OWNER_LOGIN = 'preview'
export const PREVIEW_OWNER_PASSWORD = 'preview-owner'

/** Shared by GET and HEAD when the Store Owner is not the preview login. */
export const PREVIEW_SEED_OWNER_CONFLICT = 'This Store already has an Owner. Preview seed signs in only as username preview. Use a fresh DATABASE_URL or sign in at /login.'

/** Chat lines inserted by `?tall=1`. The prefix marks a thread already filled. */
export const PREVIEW_TALL_PREFIX = 'Preview layout line '

/** Enough bubbles to scroll under the composer on a desktop Host. */
export const PREVIEW_TALL_LINE_COUNT = 32

/**
 * On only for `nuxt dev` with `DOSTIGUS_PREVIEW_SEED=1`.
 * A production Host stays closed (404).
 */
export function previewSeedAllowed(input: { dev: boolean, flag: string | undefined }): boolean {
  return input.dev === true && input.flag === '1'
}

/** `?tall=1` on GET. h3 may parse the query as a string or a number. */
export function previewTallRequested(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => item === '1' || item === 1)
  }
  return value === '1' || value === 1
}

/**
 * Oldest Bot named **New Bot**.
 * `bots` must be `listBots()` order (newest first) so a timestamp tie
 * keeps the earlier row.
 */
export function stablePreviewBotId(
  bots: Array<{ id: string, name: string, createdAt: string }>,
): string | null {
  let match: { id: string, createdAt: string } | null = null
  for (let index = bots.length - 1; index >= 0; index--) {
    const bot = bots[index]!
    if (bot.name !== DEFAULT_BOT_NAME) {
      continue
    }
    if (!match || bot.createdAt < match.createdAt) {
      match = bot
    }
  }
  return match?.id ?? null
}

export type PreviewSeedHeadResult = {
  statusCode: 204 | 302 | 409
  location?: string
}

/**
 * Read-only HEAD answer once the dev gate is already open.
 * Does not create an Owner, sign in, create a Bot, or insert Chat lines.
 */
export function readPreviewSeedHead(store: OpenedStore): PreviewSeedHeadResult {
  if (ownerExists(store) && !findOwnerSecretByLogin(store, PREVIEW_OWNER_LOGIN)) {
    return { statusCode: 409 }
  }
  const botId = stablePreviewBotId(listBots(store))
  if (!botId) {
    return { statusCode: 204 }
  }
  return { statusCode: 302, location: `/bots/${botId}` }
}

/**
 * Ensure the preview Owner and the stable preview Bot (**New Bot**, oldest).
 * A newer Bot in the Store does not replace that Chat.
 * `tall` appends preview layout lines once.
 * Throws OwnerAuthError 401 when the Store Owner is not this login.
 */
export async function ensurePreviewCluster(
  store: OpenedStore,
  hashPassword: (password: string) => Promise<string>,
  verifyPassword: (hash: string, password: string) => Promise<boolean>,
  options: { tall?: boolean } = {},
): Promise<{ user: HostSessionUser, botId: string }> {
  const user = await ensurePreviewOwner(store, hashPassword, verifyPassword)
  const botId = stablePreviewBotId(listBots(store)) ?? createBot(store, { name: DEFAULT_BOT_NAME }).bot.id
  if (options.tall) {
    ensurePreviewTallThread(store, botId, user.id)
  }
  return { user, botId }
}

export function previewTallContent(index: number): string {
  const label = `${PREVIEW_TALL_PREFIX}${index}.`
  if (index % 8 !== 0) {
    return label
  }
  return `${label}\nA longer preview line so the thread can scroll under the composer.`
}

/**
 * Append the tall thread once. Timestamps step by 1ms so Chat order
 * stays stable when several inserts share `Date.now()`.
 */
export function ensurePreviewTallThread(store: OpenedStore, botId: string, personId: string): void {
  const existing = listMessages(store, botId)
  if (existing.some((message) => message.content.startsWith(PREVIEW_TALL_PREFIX))) {
    return
  }
  let at = 0
  for (const message of existing) {
    const ms = Date.parse(message.createdAt)
    if (ms > at) {
      at = ms
    }
  }
  const stamp = store.sqlite.prepare('UPDATE messages SET created_at = ? WHERE id = ?')
  for (let index = 1; index <= PREVIEW_TALL_LINE_COUNT; index++) {
    at += 1
    const role = index % 2 === 1 ? 'user' : 'assistant'
    const message = insertMessage(store, {
      botId,
      role,
      content: previewTallContent(index),
      personId: role === 'user' ? personId : null,
    })
    stamp.run(at, message.id)
  }
}

async function ensurePreviewOwner(
  store: OpenedStore,
  hashPassword: (password: string) => Promise<string>,
  verifyPassword: (hash: string, password: string) => Promise<boolean>,
): Promise<HostSessionUser> {
  const body = {
    login: PREVIEW_OWNER_LOGIN,
    password: PREVIEW_OWNER_PASSWORD,
  }
  if (!ownerExists(store)) {
    try {
      const owner = await registerClusterOwner(store, body, hashPassword)
      return toOwnerSession(owner)
    } catch (error) {
      if (!(error instanceof OwnerAuthError) || error.statusCode !== 409) {
        throw error
      }
    }
  }
  return loginHostAccount(store, body, verifyPassword)
}
