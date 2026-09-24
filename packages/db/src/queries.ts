import type { Bot, BotAccentHex, BotAvatarShape, BotLastMessage, BotListItem, BotViewer, LlmGatewayStored, Message, MessageRole, ModelTier } from '@dostigus/shared'
import type { BotRecord, MessageRecord } from './map'
import type { OpenedStore } from './store'
import { randomUUID } from 'node:crypto'
import {
  botGreetingContent,
  botThreadPersonId,
  canSeeBot,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_SHAPE,
  DEFAULT_BOT_NAME,
  DEFAULT_MODEL_TIER,
  emptyLlmGatewayStored,
  isBotAvatarShape,
  isModelTier,
  MODEL_TIERS,
  normalizeBotAccentHex,
  serializeChatParts,
  trimOrUndefined,
} from '@dostigus/shared'
import { toBot, toMessage } from './map'

const BOT_NAME_MAX = 120
const BOT_LABEL_MAX = 160
const BOT_DESCRIPTION_MAX = 2_000
const MESSAGE_MAX = 16_000
const PREVIEW_MAX = 140

function chatPreview(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= PREVIEW_MAX) {
    return oneLine
  }
  return `${oneLine.slice(0, PREVIEW_MAX - 1)}…`
}

/** One line that still contains the match, for search rows. */
function searchSnippet(content: string, needle: string): string {
  const one = content.replace(/\s+/g, ' ').trim()
  const at = one.toLowerCase().indexOf(needle.toLowerCase())
  if (at < 0 || one.length <= PREVIEW_MAX) {
    return chatPreview(one)
  }
  const start = Math.max(0, at - 32)
  const window = 120
  let slice = one.slice(start, start + window)
  if (start > 0) {
    slice = `…${slice}`
  }
  if (start + window < one.length) {
    slice = `${slice}…`
  }
  return slice
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

/** Omit for a random id. Set for a local fixture row. */
function resolveBotId(id: string | undefined): string {
  if (id === undefined) {
    return randomUUID()
  }
  const trimmed = id.trim()
  if (!/^[\w-]{1,64}$/.test(trimmed)) {
    throw new StoreError('Bot id must be 1–64 letters, digits, _ or -', 400)
  }
  return trimmed
}

function normalizeName(name: string | undefined): string {
  const trimmed = name?.trim() ?? ''
  const value = trimmed.length > 0 ? trimmed : DEFAULT_BOT_NAME
  if (value.length > BOT_NAME_MAX) {
    throw new StoreError(`Bot name must be ${BOT_NAME_MAX} characters or fewer`, 400)
  }
  return value
}

/** Closet and Chat reject an empty rename. Create still defaults to New Bot. */
function normalizeUpdateName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new StoreError('Bot name is required', 400)
  }
  if (trimmed.length > BOT_NAME_MAX) {
    throw new StoreError(`Bot name must be ${BOT_NAME_MAX} characters or fewer`, 400)
  }
  return trimmed
}

function normalizeCapped(value: string | undefined, max: number, label: string): string {
  const trimmed = value?.trim() ?? ''
  if (trimmed.length > max) {
    throw new StoreError(`${label} must be ${max} characters or fewer`, 400)
  }
  return trimmed
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

const BOT_SELECT = `id, name, model_tier, avatar_shape, avatar_color, label, description, skills_json, modules_json, created_at, created_by`

function selectBot(store: OpenedStore, id: string): BotRecord | undefined {
  return store.sqlite.prepare(`
    SELECT ${BOT_SELECT}
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

export function listBots(store: OpenedStore, viewer?: BotViewer): BotListItem[] {
  if (viewer) {
    return listBotsForViewer(store, viewer)
  }
  const rows = store.sqlite.prepare(`
    SELECT
      ${BOT_SELECT},
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

/** Owner, creator, or a grant row. */
export function viewerMaySeeBot(store: OpenedStore, bot: Bot, viewer: BotViewer): boolean {
  if (canSeeBot(bot, viewer)) {
    return true
  }
  const row = store.sqlite.prepare(`
    SELECT 1 AS ok FROM bot_grants WHERE bot_id = ? AND person_id = ?
  `).get(bot.id, viewer.id) as { ok: number } | undefined
  return Boolean(row)
}

/** Sidebar preview is the bot-thread this person would open, not another person's lines. */
function listBotsForViewer(store: OpenedStore, viewer: BotViewer): BotListItem[] {
  const rows = store.sqlite.prepare(`
    SELECT ${BOT_SELECT}
    FROM bots
    WHERE ? = 'owner'
      OR created_by = ?
      OR EXISTS (
        SELECT 1 FROM bot_grants
        WHERE bot_grants.bot_id = bots.id AND bot_grants.person_id = ?
      )
    ORDER BY created_at DESC, rowid DESC
  `).all(viewer.role, viewer.id, viewer.id) as BotRecord[]
  return rows.map((row) => {
    const bot = toBot(row)
    const thread = findBotThread(store, bot.id, botThreadPersonId(bot, viewer))
    return {
      ...bot,
      lastMessage: thread ? lastMessageOnThread(store, thread.id) : null,
    }
  })
}

function lastMessageOnThread(store: OpenedStore, threadId: string): BotLastMessage | null {
  const row = store.sqlite.prepare(`
    SELECT content, created_at
    FROM messages
    WHERE thread_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `).get(threadId) as { content: string, created_at: number } | undefined
  if (!row) {
    return null
  }
  return {
    content: chatPreview(row.content),
    createdAt: new Date(row.created_at).toISOString(),
  }
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

function clusterOwnerId(store: OpenedStore): string | null {
  const row = store.sqlite.prepare(`
    SELECT id FROM owners ORDER BY created_at ASC, id ASC LIMIT 1
  `).get() as { id: string } | undefined
  return row?.id ?? null
}

type BotThreadRef = { id: string }

function findBotThread(store: OpenedStore, botId: string, personId: string): BotThreadRef | undefined {
  return store.sqlite.prepare(`
    SELECT t.id AS id
    FROM threads t
    INNER JOIN thread_participants person
      ON person.thread_id = t.id AND person.kind = 'person' AND person.ref_id = ?
    INNER JOIN thread_participants bot
      ON bot.thread_id = t.id AND bot.kind = 'bot' AND bot.ref_id = ?
    WHERE t.kind = 'bot'
    LIMIT 1
  `).get(personId, botId) as BotThreadRef | undefined
}

/** Stable id for one person's bot-thread with one Bot. */
export function botThreadIdFor(botId: string, personId: string): string {
  return `bt:${botId}:${personId}`
}

/**
 * One bot-thread per person and Bot. The id matches the milestone 2 cutover.
 * Opening never reuses another person's bot-thread.
 */
function ensureBotThread(store: OpenedStore, botId: string, personId: string): BotThreadRef {
  requireBot(store, botId)
  const person = personId
  const existing = findBotThread(store, botId, person)
  if (existing) {
    return existing
  }
  const id = botThreadIdFor(botId, person)
  try {
    store.sqlite.prepare(`
      INSERT INTO threads (id, kind, bot_id, created_at) VALUES (?, 'bot', ?, ?)
    `).run(id, botId, nowMs())
  } catch (error) {
    const again = findBotThread(store, botId, person)
    if (again) {
      return again
    }
    const byId = store.sqlite.prepare('SELECT id FROM threads WHERE id = ?').get(id) as BotThreadRef | undefined
    if (!byId) {
      throw error
    }
  }
  store.sqlite.prepare(`
    INSERT OR IGNORE INTO thread_participants (thread_id, kind, ref_id) VALUES (?, 'person', ?)
  `).run(id, person)
  store.sqlite.prepare(`
    INSERT OR IGNORE INTO thread_participants (thread_id, kind, ref_id) VALUES (?, 'bot', ?)
  `).run(id, botId)
  return { id }
}

/** The person's bot-thread with this Bot, creating it when missing. */
export function openBotThread(store: OpenedStore, botId: string, personId: string): string {
  return ensureBotThread(store, botId, personId).id
}

/** Greeting thread when the Store has no Owner and no creator yet. */
function soleBotThreadId(store: OpenedStore, botId: string): string {
  const rows = store.sqlite.prepare(`
    SELECT id FROM threads
    WHERE kind = 'bot' AND bot_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(botId) as BotThreadRef[]
  const first = rows[0]
  if (first) {
    return first.id
  }
  const id = `bt:${botId}:_`
  store.sqlite.prepare(`
    INSERT INTO threads (id, kind, bot_id, created_at) VALUES (?, 'bot', ?, ?)
  `).run(id, botId, nowMs())
  store.sqlite.prepare(`
    INSERT OR IGNORE INTO thread_participants (thread_id, kind, ref_id) VALUES (?, 'bot', ?)
  `).run(id, botId)
  return id
}

function resolveMessageThreadId(
  store: OpenedStore,
  bot: Bot,
  input: {
    role: MessageRole
    personId: string | null
    viewer?: BotViewer
    threadId?: string
  },
): string {
  if (input.threadId) {
    const row = store.sqlite.prepare(`
      SELECT id FROM threads
      WHERE id = ? AND kind = 'bot' AND bot_id = ?
    `).get(input.threadId, bot.id) as BotThreadRef | undefined
    if (!row) {
      throw new StoreError('Thread not found', 404)
    }
    return row.id
  }
  if (input.viewer) {
    return ensureBotThread(store, bot.id, botThreadPersonId(bot, input.viewer)).id
  }
  if (input.role === 'user' && input.personId) {
    return ensureBotThread(store, bot.id, input.personId).id
  }
  const ownerId = clusterOwnerId(store)
  if (ownerId) {
    return ensureBotThread(store, bot.id, ownerId).id
  }
  return soleBotThreadId(store, bot.id)
}

function insertMessageRow(
  store: OpenedStore,
  input: {
    botId: string | null
    role: MessageRole
    content: string
    personId?: string | null
    /** Assistant Kit parts. User and system lines store `[]`. See ADR 0025. */
    parts?: unknown
    threadId: string
  },
): Message {
  const personId = input.personId ?? null
  const partsJson = serializeChatParts(input.role, input.parts)
  const row: MessageRecord = {
    id: randomUUID(),
    bot_id: input.botId,
    role: input.role,
    content: input.content,
    created_at: nowMs(),
    person_id: personId,
    parts_json: partsJson,
    thread_id: input.threadId,
  }
  store.sqlite.prepare(`
    INSERT INTO messages (id, bot_id, role, content, created_at, person_id, parts_json, thread_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(row.id, row.bot_id, row.role, row.content, row.created_at, personId, partsJson, input.threadId)
  return toMessage(row)
}

export function insertMessage(
  store: OpenedStore,
  input: {
    botId: string
    role: MessageRole
    content: string
    personId?: string | null
    /** Assistant Kit parts. Ignored for user and system. See ADR 0025. */
    parts?: unknown
    /** Places the line on this person's open bot-thread. */
    viewer?: BotViewer
    threadId?: string
  },
): Message {
  const bot = requireBot(store, input.botId)
  if (input.viewer && !viewerMaySeeBot(store, bot, input.viewer)) {
    throw new StoreError('Bot not found', 404)
  }
  const threadId = resolveMessageThreadId(store, bot, {
    role: input.role,
    personId: input.personId ?? null,
    viewer: input.viewer,
    threadId: input.threadId,
  })
  return insertMessageRow(store, {
    botId: input.botId,
    role: input.role,
    content: normalizeContent(input.content),
    personId: input.personId ?? null,
    parts: input.parts,
    threadId,
  })
}

/** A line on any Thread. `botId` stays empty on a person line in a dm, group, or room. */
export function insertThreadLine(
  store: OpenedStore,
  input: {
    threadId: string
    role: MessageRole
    content: string
    personId?: string | null
    botId?: string | null
    parts?: unknown
  },
): Message {
  const thread = store.sqlite.prepare('SELECT id FROM threads WHERE id = ?').get(input.threadId) as { id: string } | undefined
  if (!thread) {
    throw new StoreError('Thread not found', 404)
  }
  if (input.botId) {
    requireBot(store, input.botId)
  }
  return insertMessageRow(store, {
    botId: input.botId ?? null,
    role: input.role,
    content: normalizeContent(input.content),
    personId: input.personId ?? null,
    parts: input.parts,
    threadId: input.threadId,
  })
}

const MESSAGE_SELECT = `id, bot_id, role, content, created_at, person_id, parts_json, thread_id`

export function listMessages(store: OpenedStore, botId: string): Message[] {
  requireBot(store, botId)
  const rows = store.sqlite.prepare(`
    SELECT ${MESSAGE_SELECT}
    FROM messages
    WHERE bot_id = ?
    ORDER BY created_at ASC, rowid ASC
  `).all(botId) as MessageRecord[]
  return rows.map(toMessage)
}

/**
 * Lines on one bot-thread. Ensures the greeting on that thread first.
 * Omit `personId` for the Owner thread, or the only thread when no Owner exists.
 */
export function listBotThreadMessages(
  store: OpenedStore,
  botId: string,
  personId?: string | null,
): Message[] {
  const greeting = ensureGreeting(store, botId, personId)
  const row = store.sqlite.prepare(`
    SELECT thread_id FROM messages WHERE id = ?
  `).get(greeting.id) as { thread_id: string | null } | undefined
  if (!row?.thread_id) {
    return []
  }
  return listThreadMessages(store, row.thread_id)
}

export function listThreadMessages(store: OpenedStore, threadId: string): Message[] {
  const rows = store.sqlite.prepare(`
    SELECT ${MESSAGE_SELECT}
    FROM messages
    WHERE thread_id = ?
    ORDER BY created_at ASC, rowid ASC
  `).all(threadId) as MessageRecord[]
  return rows.map(toMessage)
}

export type MessageSearchHit = {
  id: string
  botId: string | null
  botName: string
  content: string
  createdAt: string
  threadId: string | null
  threadKind: string | null
}

const SEARCH_QUERY_MAX = 200
const SEARCH_LIMIT = 8

type MessageSearchRow = {
  id: string
  bot_id: string | null
  content: string
  created_at: number
  bot_name: string
  thread_id: string | null
  thread_kind: string | null
}

/** Chat lines whose text contains the query. `%` and `_` stay literal. */
export function searchMessages(
  store: OpenedStore,
  query: string,
  limit = SEARCH_LIMIT,
  viewer?: BotViewer,
): MessageSearchHit[] {
  const needle = query.trim().slice(0, SEARCH_QUERY_MAX)
  if (!needle) {
    return []
  }
  const escaped = needle.replace(/[\\%_]/g, (ch) => `\\${ch}`)
  const cap = Math.min(SEARCH_LIMIT, Math.max(1, limit))
  const threadClause = viewer ? viewerThreadClause(store, viewer) : null
  if (viewer && !threadClause) {
    return []
  }
  const rows = store.sqlite.prepare(`
    SELECT
      messages.id AS id,
      messages.bot_id AS bot_id,
      messages.content AS content,
      messages.created_at AS created_at,
      messages.thread_id AS thread_id,
      COALESCE(bots.name, threads.title, '') AS bot_name,
      threads.kind AS thread_kind
    FROM messages
    LEFT JOIN bots ON bots.id = messages.bot_id
    LEFT JOIN threads ON threads.id = messages.thread_id
    WHERE messages.content LIKE ? ESCAPE '\\'
      ${threadClause ? `AND messages.thread_id IN (${threadClause.placeholders})` : ''}
    ORDER BY messages.created_at DESC, messages.rowid DESC
    LIMIT ?
  `).all(`%${escaped}%`, ...(threadClause?.ids ?? []), cap) as MessageSearchRow[]
  return rows.map((row) => ({
    id: row.id,
    botId: row.bot_id,
    botName: row.bot_name || searchThreadLabel(row.thread_kind),
    content: searchSnippet(row.content, needle),
    createdAt: new Date(row.created_at).toISOString(),
    threadId: row.thread_id,
    threadKind: row.thread_kind,
  }))
}

function searchThreadLabel(kind: string | null): string {
  if (kind === 'dm') {
    return 'Direct message'
  }
  if (kind === 'group') {
    return 'Group'
  }
  if (kind === 'room') {
    return 'Room'
  }
  return 'Chat'
}

/** Thread ids this person may search: their bot-threads and Threads they have joined. */
function viewerThreadClause(
  store: OpenedStore,
  viewer: BotViewer,
): { placeholders: string, ids: string[] } | null {
  const ids = new Set<string>()
  for (const bot of listBots(store, viewer)) {
    const thread = findBotThread(store, bot.id, botThreadPersonId(bot, viewer))
    if (thread) {
      ids.add(thread.id)
    }
  }
  const joined = store.sqlite.prepare(`
    SELECT thread_id FROM thread_participants
    WHERE kind = 'person' AND ref_id = ?
  `).all(viewer.id) as { thread_id: string }[]
  for (const row of joined) {
    ids.add(row.thread_id)
  }
  if (ids.size === 0) {
    return null
  }
  const list = [...ids]
  return {
    placeholders: list.map(() => '?').join(', '),
    ids: list,
  }
}

/**
 * Insert the assistant greeting when that bot-thread has no lines.
 * `personId` is the person on the bot-thread. Omit it for the Owner, or
 * the only thread when the Store has no Owner yet.
 */
export function ensureGreeting(store: OpenedStore, botId: string, personId?: string | null): Message {
  const bot = requireBot(store, botId)
  const person = personId || clusterOwnerId(store)
  if (person) {
    const thread = ensureBotThread(store, botId, person)
    const existing = listThreadMessages(store, thread.id)
    if (existing.length > 0) {
      return existing[0]!
    }
    return insertMessageRow(store, {
      botId,
      role: 'assistant',
      content: botGreetingContent(bot.name),
      threadId: thread.id,
    })
  }
  const existing = listMessages(store, botId)
  if (existing.length > 0) {
    return existing[0]!
  }
  return insertMessageRow(store, {
    botId,
    role: 'assistant',
    content: botGreetingContent(bot.name),
    threadId: soleBotThreadId(store, botId),
  })
}

function resolveCreatedBy(store: OpenedStore, explicit: string | undefined): string | null {
  const trimmed = explicit?.trim()
  if (trimmed) {
    return trimmed
  }
  return clusterOwnerId(store)
}

export function createBot(
  store: OpenedStore,
  input: {
    /** Omit for a random id. Set for a local fixture row. */
    id?: string
    name?: string
    modelTier?: string
    avatarShape?: string
    avatarColor?: string
    label?: string
    description?: string
    /** Owner or Member id. Defaults to the Cluster Owner when one exists. */
    createdBy?: string
  } = {},
): { bot: Bot, greeting: Message } {
  const name = normalizeName(input.name)
  const modelTier = normalizeTier(input.modelTier)
  const avatarShape = normalizeAvatarShape(input.avatarShape)
  const avatarColor = normalizeAvatarColor(input.avatarColor)
  const label = normalizeCapped(input.label, BOT_LABEL_MAX, 'Label')
  const description = normalizeCapped(input.description, BOT_DESCRIPTION_MAX, 'Description')
  const createdBy = resolveCreatedBy(store, input.createdBy)
  const createdAt = nowMs()
  const id = resolveBotId(input.id)
  if (input.id !== undefined && selectBot(store, id)) {
    throw new StoreError('Bot id already exists', 409)
  }

  store.sqlite.prepare(`
    INSERT INTO bots (
      id, name, model_tier, avatar_shape, avatar_color, label, description,
      skills_json, modules_json, created_at, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, ?)
  `).run(id, name, modelTier, avatarShape, avatarColor, label, description, createdAt, createdBy)

  const threadId = createdBy
    ? ensureBotThread(store, id, createdBy).id
    : soleBotThreadId(store, id)
  const greeting = insertMessageRow(store, {
    botId: id,
    role: 'assistant',
    content: botGreetingContent(name),
    threadId,
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
    label?: string
    description?: string
  },
): Bot {
  const current = requireBot(store, id)
  const sets: string[] = []
  const params: Array<string | number> = []
  if (input.name !== undefined) {
    sets.push('name = ?')
    params.push(normalizeUpdateName(input.name))
  }
  if (input.modelTier !== undefined) {
    sets.push('model_tier = ?')
    params.push(normalizeTier(input.modelTier))
  }
  if (input.avatarShape !== undefined) {
    sets.push('avatar_shape = ?')
    params.push(normalizeAvatarShape(input.avatarShape))
  }
  if (input.avatarColor !== undefined) {
    sets.push('avatar_color = ?')
    params.push(normalizeAvatarColor(input.avatarColor))
  }
  if (input.label !== undefined) {
    sets.push('label = ?')
    params.push(normalizeCapped(input.label, BOT_LABEL_MAX, 'Label'))
  }
  if (input.description !== undefined) {
    sets.push('description = ?')
    params.push(normalizeCapped(input.description, BOT_DESCRIPTION_MAX, 'Description'))
  }
  if (sets.length === 0) {
    return current
  }
  params.push(id)
  store.sqlite.prepare(`
    UPDATE bots
    SET ${sets.join(', ')}
    WHERE id = ?
  `).run(...params)

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
