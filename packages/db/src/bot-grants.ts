import type { OpenedStore } from './store'
import { getMember } from './members'
import { getOwner } from './owners'
import { requireBot } from './queries'
import { StoreError } from './store-error'

export type BotGrant = {
  botId: string
  personId: string
  displayName: string
  createdAt: string
}

type GrantRow = {
  bot_id: string
  person_id: string
  created_at: number
  display_name: string | null
}

function toGrant(row: GrantRow): BotGrant {
  return {
    botId: row.bot_id,
    personId: row.person_id,
    displayName: row.display_name?.trim() || row.person_id,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export function listBotGrants(store: OpenedStore, botId: string): BotGrant[] {
  requireBot(store, botId)
  const rows = store.sqlite.prepare(`
    SELECT
      bot_grants.bot_id AS bot_id,
      bot_grants.person_id AS person_id,
      bot_grants.created_at AS created_at,
      members.display_name AS display_name
    FROM bot_grants
    LEFT JOIN members ON members.id = bot_grants.person_id
    WHERE bot_grants.bot_id = ?
    ORDER BY bot_grants.created_at ASC, bot_grants.person_id ASC
  `).all(botId) as GrantRow[]
  return rows.map(toGrant)
}

function assertGrantTarget(store: OpenedStore, botId: string, personId: string): void {
  const bot = requireBot(store, botId)
  const trimmed = personId.trim()
  if (!trimmed) {
    throw new StoreError('Name a Member', 400)
  }
  if (bot.createdBy != null && bot.createdBy === trimmed) {
    throw new StoreError('The creator already has this Bot', 400)
  }
  if (getOwner(store, trimmed)) {
    throw new StoreError('The Owner already sees every Bot', 400)
  }
  const member = getMember(store, trimmed)
  if (!member) {
    throw new StoreError('That person is not a Member', 400)
  }
}

/** One grant row. A second grant for the same person returns the existing row. */
export function grantBot(store: OpenedStore, botId: string, personId: string): BotGrant {
  const id = personId.trim()
  assertGrantTarget(store, botId, id)
  const createdAt = Date.now()
  store.sqlite.prepare(`
    INSERT OR IGNORE INTO bot_grants (bot_id, person_id, created_at) VALUES (?, ?, ?)
  `).run(botId, id, createdAt)
  const grant = listBotGrants(store, botId).find((row) => row.personId === id)
  if (!grant) {
    throw new StoreError('Bot not found', 404)
  }
  return grant
}

/**
 * One-shot batch for Members who exist now and can sign in.
 * Skips the creator. Does not grant a Member added later.
 * A disabled Member is not in this batch.
 */
export function grantBotToCurrentMembers(store: OpenedStore, botId: string): BotGrant[] {
  const bot = requireBot(store, botId)
  const createdAt = Date.now()
  store.sqlite.prepare(`
    INSERT OR IGNORE INTO bot_grants (bot_id, person_id, created_at)
    SELECT ?, members.id, ?
    FROM members
    WHERE members.disabled_at IS NULL
      AND members.id != COALESCE(?, '')
  `).run(botId, createdAt, bot.createdBy)
  return listBotGrants(store, botId)
}

/** Drops list and open. The person's bot-thread rows stay. */
export function revokeBotGrant(store: OpenedStore, botId: string, personId: string): void {
  requireBot(store, botId)
  store.sqlite.prepare(`
    DELETE FROM bot_grants WHERE bot_id = ? AND person_id = ?
  `).run(botId, personId.trim())
}
