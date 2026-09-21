import type { Bot, Message, MessageRole, ModelTier } from '@dostigus/shared'
import type { BotRecord, MessageRecord } from './map'
import type { OpenedStore } from './store'
import { randomUUID } from 'node:crypto'
import {
  botGreetingContent,
  DEFAULT_BOT_NAME,
  DEFAULT_MODEL_TIER,
  isModelTier,
} from '@dostigus/shared'
import { toBot, toMessage } from './map'

const BOT_NAME_MAX = 120
const MESSAGE_MAX = 16_000

export class StoreError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
    this.name = 'StoreError'
  }
}

function nowMs(): number {
  return Date.now()
}

function normalizeName(name: string | undefined): string {
  const trimmed = name?.trim() ?? ''
  const value = trimmed.length > 0 ? trimmed : DEFAULT_BOT_NAME
  if (value.length > BOT_NAME_MAX) {
    throw new StoreError(`Bot name must be ${BOT_NAME_MAX} characters or fewer`, 400)
  }
  return value
}

function normalizeTier(value: string | undefined): ModelTier {
  if (value == null || value === '') {
    return DEFAULT_MODEL_TIER
  }
  if (!isModelTier(value)) {
    throw new StoreError(`Unknown Model tier: ${value}`, 400)
  }
  return value
}

function normalizeContent(content: string | undefined): string {
  const trimmed = content?.trim() ?? ''
  if (trimmed.length === 0) {
    throw new StoreError('Message content is required', 400)
  }
  if (trimmed.length > MESSAGE_MAX) {
    throw new StoreError(`Message must be ${MESSAGE_MAX} characters or fewer`, 400)
  }
  return trimmed
}

function selectBot(store: OpenedStore, id: string): BotRecord | undefined {
  return store.sqlite.prepare(`
    SELECT id, name, model_tier, skills_json, modules_json, created_at
    FROM bots
    WHERE id = ?
  `).get(id) as BotRecord | undefined
}

export function listBots(store: OpenedStore): Bot[] {
  const rows = store.sqlite.prepare(`
    SELECT id, name, model_tier, skills_json, modules_json, created_at
    FROM bots
    ORDER BY created_at DESC, rowid DESC
  `).all() as BotRecord[]
  return rows.map(toBot)
}

export function getBot(store: OpenedStore, id: string): Bot | undefined {
  const row = selectBot(store, id)
  return row ? toBot(row) : undefined
}

export function requireBot(store: OpenedStore, id: string): Bot {
  const bot = getBot(store, id)
  if (!bot) {
    throw new StoreError('Bot not found', 404)
  }
  return bot
}

function insertMessageRow(
  store: OpenedStore,
  input: { botId: string, role: MessageRole, content: string },
): Message {
  const row: MessageRecord = {
    id: randomUUID(),
    bot_id: input.botId,
    role: input.role,
    content: input.content,
    created_at: nowMs(),
  }
  store.sqlite.prepare(`
    INSERT INTO messages (id, bot_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(row.id, row.bot_id, row.role, row.content, row.created_at)
  return toMessage(row)
}

export function insertMessage(
  store: OpenedStore,
  input: { botId: string, role: MessageRole, content: string },
): Message {
  requireBot(store, input.botId)
  return insertMessageRow(store, {
    botId: input.botId,
    role: input.role,
    content: normalizeContent(input.content),
  })
}

export function listMessages(store: OpenedStore, botId: string): Message[] {
  requireBot(store, botId)
  const rows = store.sqlite.prepare(`
    SELECT id, bot_id, role, content, created_at
    FROM messages
    WHERE bot_id = ?
    ORDER BY created_at ASC
  `).all(botId) as MessageRecord[]
  return rows.map(toMessage)
}

/** Insert the first assistant greeting when the Chat has no messages. */
export function ensureGreeting(store: OpenedStore, botId: string): Message {
  const bot = requireBot(store, botId)
  const existing = listMessages(store, botId)
  if (existing.length > 0) {
    return existing[0]!
  }
  return insertMessageRow(store, {
    botId,
    role: 'assistant',
    content: botGreetingContent(bot.name),
  })
}

export function createBot(
  store: OpenedStore,
  input: { name?: string, modelTier?: string } = {},
): { bot: Bot, greeting: Message } {
  const name = normalizeName(input.name)
  const modelTier = normalizeTier(input.modelTier)
  const createdAt = nowMs()
  const id = randomUUID()

  store.sqlite.prepare(`
    INSERT INTO bots (id, name, model_tier, skills_json, modules_json, created_at)
    VALUES (?, ?, ?, '[]', '[]', ?)
  `).run(id, name, modelTier, createdAt)

  const greeting = insertMessageRow(store, {
    botId: id,
    role: 'assistant',
    content: botGreetingContent(name),
  })

  return { bot: requireBot(store, id), greeting }
}

export function updateBot(
  store: OpenedStore,
  id: string,
  input: { name?: string, modelTier?: string },
): Bot {
  const current = requireBot(store, id)
  const name = input.name !== undefined ? normalizeName(input.name) : current.name
  const modelTier = input.modelTier !== undefined
    ? normalizeTier(input.modelTier)
    : current.manifest.modelTier

  store.sqlite.prepare(`
    UPDATE bots
    SET name = ?, model_tier = ?
    WHERE id = ?
  `).run(name, modelTier, id)

  return requireBot(store, id)
}

export function deleteBot(store: OpenedStore, id: string): void {
  requireBot(store, id)
  store.sqlite.prepare('DELETE FROM bots WHERE id = ?').run(id)
}
