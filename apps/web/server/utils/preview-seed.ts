import type { OpenedStore } from '@dostigus/db'
import type { HostSessionUser } from './owner-auth'
import { createBot, listBots, ownerExists } from '@dostigus/db'
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

/**
 * On only for `nuxt dev` with `DOSTIGUS_PREVIEW_SEED=1`.
 * A production Host stays closed (404).
 */
export function previewSeedAllowed(input: { dev: boolean, flag: string | undefined }): boolean {
  return input.dev === true && input.flag === '1'
}

/**
 * Ensure the preview Owner is signed-in material and at least one Bot exists.
 * Reuses the existing Owner and the newest Bot on later calls.
 * Throws OwnerAuthError 401 when the Store Owner is not this login.
 */
export async function ensurePreviewCluster(
  store: OpenedStore,
  hashPassword: (password: string) => Promise<string>,
  verifyPassword: (hash: string, password: string) => Promise<boolean>,
): Promise<{ user: HostSessionUser, botId: string }> {
  const user = await ensurePreviewOwner(store, hashPassword, verifyPassword)
  const existing = listBots(store)
  const botId = existing[0]?.id ?? createBot(store, { name: DEFAULT_BOT_NAME }).bot.id
  return { user, botId }
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
