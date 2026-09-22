import type { Bot, BotAccentHex, BotAvatarShape, BotLastMessage, BotListItem, LlmGatewayStored, Message, MessageRole, ModelTier } from '@dostigus/shared'
import type { BotRecord, MessageRecord } from './map'
import type { OpenedStore } from './store'
import { randomUUID } from 'node:crypto'
import {
  botGreetingContent,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_SHAPE,
  DEFAULT_BOT_NAME,
  DEFAULT_MODEL_TIER,
  emptyLlmGatewayStored,
  isBotAvatarShape,
  isModelTier,
  MODEL_TIERS,
  normalizeBotAccentHex,
  trimOrUndefined,
} from '@dostigus/shared'
import { toBot, toMessage } from './map'

const BOT_NAME_MAX = 120
const MESSAGE_MAX = 16_000
const PREVIEW_MAX = 140

function chatPreview(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= PREVIEW_MAX) {
    return oneLine
  }
  return `${oneLine.slice(0, PREVIEW_MAX - 1)}…`
}

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

function normalizeAvatarShape(value: string | undefined): BotAvatarShape {
  if (value == null || value === '') {
    return DEFAULT_AVATAR_SHAPE
  }
  if (!isBotAvatarShape(value)) {
    throw new StoreError(`Unknown avatar shape: ${value}`, 400)
  }
  return value
}

function normalizeAvatarColor(value: string | undefined): BotAccentHex {
  if (value == null || value === '') {
    return DEFAULT_AVATAR_COLOR
  }
  const hex = normalizeBotAccentHex(value)
  if (!hex) {
    throw new StoreError(`Unknown avatar color: ${value}`, 400)
  }
  return hex
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
    SELECT id, name, model_tier, avatar_shape, avatar_color, skills_json, modules_json, created_at
    FROM bots
    WHERE id = ?
  `).get(id) as BotRecord | undefined
}

type BotListRecord = BotRecord & {
  last_content: string | null
  last_created_at: number | null
}

function lastMessageFromRow(row: BotListRecord): BotLastMessage | null {
  if (row.last_content == null || row.last_created_at == null) {
    return null
  }
  return {
    content: chatPreview(row.last_content),
    createdAt: new Date(row.last_created_at).toISOString(),
  }
}

export function listBots(store: OpenedStore): BotListItem[] {
  const rows = store.sqlite.prepare(`
    SELECT
      id,
      name,
      model_tier,
      avatar_shape,
      avatar_color,
      skills_json,
      modules_json,
      created_at,
      (
        SELECT content
        FROM messages
        WHERE bot_id = bots.id
        ORDER BY created_at DESC, rowid DESC
        LIMIT 1
      ) AS last_content,
      (
        SELECT created_at
        FROM messages
        WHERE bot_id = bots.id
        ORDER BY created_at DESC, rowid DESC
        LIMIT 1
      ) AS last_created_at
    FROM bots
    ORDER BY created_at DESC, rowid DESC
  `).all() as BotListRecord[]
  return rows.map((row) => ({
    ...toBot(row),
    lastMessage: lastMessageFromRow(row),
  }))
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
  input: { botId: string, role: MessageRole, content: string, personId?: string | null },
): Message {
  const personId = input.personId ?? null
  const row: MessageRecord = {
    id: randomUUID(),
    bot_id: input.botId,
    role: input.role,
    content: input.content,
    created_at: nowMs(),
    person_id: personId,
  }
  store.sqlite.prepare(`
    INSERT INTO messages (id, bot_id, role, content, created_at, person_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(row.id, row.bot_id, row.role, row.content, row.created_at, personId)
  return toMessage(row)
}

export function insertMessage(
  store: OpenedStore,
  input: { botId: string, role: MessageRole, content: string, personId?: string | null },
): Message {
  requireBot(store, input.botId)
  return insertMessageRow(store, {
    botId: input.botId,
    role: input.role,
    content: normalizeContent(input.content),
    personId: input.personId ?? null,
  })
}

export function listMessages(store: OpenedStore, botId: string): Message[] {
  requireBot(store, botId)
  const rows = store.sqlite.prepare(`
    SELECT id, bot_id, role, content, created_at, person_id
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
  input: {
    name?: string
    modelTier?: string
    avatarShape?: string
    avatarColor?: string
  } = {},
): { bot: Bot, greeting: Message } {
  const name = normalizeName(input.name)
  const modelTier = normalizeTier(input.modelTier)
  const avatarShape = normalizeAvatarShape(input.avatarShape)
  const avatarColor = normalizeAvatarColor(input.avatarColor)
  const createdAt = nowMs()
  const id = randomUUID()

  store.sqlite.prepare(`
    INSERT INTO bots (id, name, model_tier, avatar_shape, avatar_color, skills_json, modules_json, created_at)
    VALUES (?, ?, ?, ?, ?, '[]', '[]', ?)
  `).run(id, name, modelTier, avatarShape, avatarColor, createdAt)

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
  input: {
    name?: string
    modelTier?: string
    avatarShape?: string
    avatarColor?: string
  },
): Bot {
  const current = requireBot(store, id)
  const name = input.name !== undefined ? normalizeName(input.name) : current.name
  const modelTier = input.modelTier !== undefined
    ? normalizeTier(input.modelTier)
    : current.manifest.modelTier
  const avatarShape = input.avatarShape !== undefined
    ? normalizeAvatarShape(input.avatarShape)
    : current.manifest.avatarShape
  const avatarColor = input.avatarColor !== undefined
    ? normalizeAvatarColor(input.avatarColor)
    : current.manifest.avatarColor

  store.sqlite.prepare(`
    UPDATE bots
    SET name = ?, model_tier = ?, avatar_shape = ?, avatar_color = ?
    WHERE id = ?
  `).run(name, modelTier, avatarShape, avatarColor, id)

  return requireBot(store, id)
}

export function deleteBot(store: OpenedStore, id: string): void {
  requireBot(store, id)
  store.sqlite.prepare('DELETE FROM bots WHERE id = ?').run(id)
}

const LLM_GATEWAY_ID = 'cluster'
const BASE_URL_MAX = 500
const MODEL_ID_MAX = 200

type LlmGatewayRecord = {
  id: string
  base_url: string | null
  api_key: string | null
  default_tier: string
  models_json: string
  updated_at: number
}

function parseModelOverrides(raw: string): Partial<Record<ModelTier, string>> {
  try {
    const value = JSON.parse(raw) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    const out: Partial<Record<ModelTier, string>> = {}
    for (const tier of MODEL_TIERS) {
      const item = (value as Record<string, unknown>)[tier]
      if (typeof item === 'string' && item.trim()) {
        out[tier] = item.trim()
      }
    }
    return out
  } catch {
    return {}
  }
}

function toLlmGatewayStored(row: LlmGatewayRecord): LlmGatewayStored {
  return {
    baseUrl: row.base_url,
    apiKey: row.api_key,
    defaultTier: isModelTier(row.default_tier) ? row.default_tier : DEFAULT_MODEL_TIER,
    modelOverrides: parseModelOverrides(row.models_json),
  }
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmed = trimOrUndefined(value) ?? null
  if (!trimmed) {
    return null
  }
  if (trimmed.length > BASE_URL_MAX) {
    throw new StoreError(`LLM gateway base URL must be ${BASE_URL_MAX} characters or fewer`, 400)
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new StoreError('LLM gateway base URL must be an http(s) URL', 400)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new StoreError('LLM gateway base URL must be an http(s) URL', 400)
  }
  return trimmed.replace(/\/$/, '')
}

function normalizeModelOverrides(
  value: Partial<Record<ModelTier, string>> | undefined,
): Partial<Record<ModelTier, string>> {
  if (!value) {
    return {}
  }
  const out: Partial<Record<ModelTier, string>> = {}
  for (const tier of MODEL_TIERS) {
    const item = trimOrUndefined(value[tier])
    if (!item) {
      continue
    }
    if (item.length > MODEL_ID_MAX) {
      throw new StoreError(`Model id must be ${MODEL_ID_MAX} characters or fewer`, 400)
    }
    out[tier] = item
  }
  return out
}

export function getLlmGatewaySettings(store: OpenedStore): LlmGatewayStored {
  const row = store.sqlite.prepare(`
    SELECT id, base_url, api_key, default_tier, models_json, updated_at
    FROM llm_gateway
    WHERE id = ?
  `).get(LLM_GATEWAY_ID) as LlmGatewayRecord | undefined
  return row ? toLlmGatewayStored(row) : emptyLlmGatewayStored()
}

export function upsertLlmGatewaySettings(
  store: OpenedStore,
  input: {
    baseUrl?: string | null
    apiKey?: string | null
    clearApiKey?: boolean
    defaultTier?: string
    modelOverrides?: Partial<Record<ModelTier, string>>
  },
): LlmGatewayStored {
  const current = getLlmGatewaySettings(store)
  const baseUrl = input.baseUrl !== undefined ? normalizeBaseUrl(input.baseUrl) : current.baseUrl
  const defaultTier = input.defaultTier !== undefined
    ? normalizeTier(input.defaultTier)
    : current.defaultTier
  const modelOverrides = input.modelOverrides !== undefined
    ? normalizeModelOverrides(input.modelOverrides)
    : current.modelOverrides

  let apiKey = current.apiKey
  if (input.clearApiKey) {
    apiKey = null
  } else if (input.apiKey !== undefined) {
    const trimmed = trimOrUndefined(input.apiKey) ?? null
    if (trimmed) {
      apiKey = trimmed
    }
  }

  const updatedAt = nowMs()
  store.sqlite.prepare(`
    INSERT INTO llm_gateway (id, base_url, api_key, default_tier, models_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      base_url = excluded.base_url,
      api_key = excluded.api_key,
      default_tier = excluded.default_tier,
      models_json = excluded.models_json,
      updated_at = excluded.updated_at
  `).run(
    LLM_GATEWAY_ID,
    baseUrl,
    apiKey,
    defaultTier,
    JSON.stringify(modelOverrides),
    updatedAt,
  )

  return getLlmGatewaySettings(store)
}
