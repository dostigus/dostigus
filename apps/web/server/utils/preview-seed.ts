import type { OpenedStore } from '@dostigus/db'
import type { ChatPart } from '@dostigus/shared'
import type { HostSessionUser } from './owner-auth'
import { addKitchenPantry, createBot, createMember, createMessengerThread, findMemberSecretByLogin, findOwnerSecretByLogin, getBot, getKitchenRecipe, grantBot, insertMessage, insertThreadLine, listBots, listKitchenCooked, listKitchenPantry, listMessages, listThreadMessages, markKitchenCooked, ownerExists, saveKitchenRecipe } from '@dostigus/db'
import { DEFAULT_BOT_NAME } from '@dostigus/shared'
import { HOST_DEMO_SHEET_ID, HOST_KITCHEN_SHEET_ID } from '../../app/utils/host-sheets'
import { previewChatLocation } from '../../app/utils/preview-hold'
import { appendClusterMessage } from './cluster-bots'
import {
  loginHostAccount,
  OwnerAuthError,
  registerClusterOwner,
  toMemberSession,
  toOwnerSession,
} from './owner-auth'

/** Local preview Owner. Created only when the preview seed route runs. */
export const PREVIEW_OWNER_LOGIN = 'preview'
export const PREVIEW_OWNER_PASSWORD = 'preview-owner'

/** Local preview Member. Created by `?threads=1`. */
export const PREVIEW_MEMBER_LOGIN = 'preview-member'
export const PREVIEW_MEMBER_PASSWORD = 'preview-member'

/** Member-created Bot. The Owner sees it. Id stays `preview-private`. */
export const PREVIEW_PRIVATE_BOT_ID = 'preview-private'
export const PREVIEW_PRIVATE_BOT_NAME = 'Private notes'

/** User line on the Owner's bot-thread with the shared preview Bot. */
export const PREVIEW_OWNER_THREAD_PREFIX = 'Owner thread on the shared Bot.'

/** User line on the Member's bot-thread with the same shared Bot. */
export const PREVIEW_MEMBER_THREAD_PREFIX = 'Member thread on the shared Bot.'

/** User line on the Member's only bot-thread with their private Bot. */
export const PREVIEW_PRIVATE_THREAD_PREFIX = 'Member thread on the private Bot.'

/** Fixture direct message between the preview Owner and Member. */
export const PREVIEW_DM_THREAD_ID = 'preview-dm'

/** Owner line on that direct message. */
export const PREVIEW_DM_PREFIX = 'Preview direct message.'

/** Member line on that direct message. */
export const PREVIEW_DM_REPLY_PREFIX = 'Preview member on the direct message.'

/** Fixture room: Owner, Member, and the shared preview Bot. */
export const PREVIEW_ROOM_THREAD_ID = 'preview-room'
export const PREVIEW_ROOM_TITLE = 'Preview room'

/** Owner line in the room. It mentions the shared Bot by name. */
export const PREVIEW_ROOM_PREFIX = 'Preview room.'

/** Stored Bot reply in the room. Not a live gateway call. */
export const PREVIEW_ROOM_REPLY_PREFIX = 'Preview room reply.'

/**
 * Fixture Bot id for local preview.
 * Display name starts as **New Bot** and may change. The id does not.
 */
export const PREVIEW_BOT_ID = 'preview'

/** Shared by GET and HEAD when the Store Owner is not the preview login. */
export const PREVIEW_SEED_OWNER_CONFLICT = 'This Store already has an Owner. Preview seed signs in only as username preview. Use a fresh DATABASE_URL or sign in at /login.'

/** Chat lines inserted by `?tall=1`. The prefix marks a thread already filled. */
export const PREVIEW_TALL_PREFIX = 'Preview layout line '

/** Enough bubbles to scroll under the composer on a desktop Host. */
export const PREVIEW_TALL_LINE_COUNT = 32

/**
 * Assistant line inserted by `?parts=1`. The prefix marks a bubble already filled.
 * Markdown stays in content. The button and status live in parts.
 */
export const PREVIEW_PARTS_PREFIX = 'Preview Kit parts.'

/**
 * Assistant line inserted by `?kitchen=1`. The prefix marks a bubble already filled.
 * The button opens the Kitchen Sheet. Domain rows are filled only while empty.
 */
export const PREVIEW_KITCHEN_PREFIX = 'Kitchen is open.'

/**
 * On only for `nuxt dev` with `DOSTIGUS_PREVIEW_SEED=1`.
 * A production Host stays closed (404).
 */
export function previewSeedAllowed(input: { dev: boolean, flag: string | undefined }): boolean {
  return input.dev === true && input.flag === '1'
}

/** `?tall=1` on GET. h3 may parse the query as a string or a number. */
export function previewTallRequested(value: unknown): boolean {
  return previewQueryOn(value)
}

/**
 * `?members=1` on GET. Opens Members for the signed-in preview Owner.
 * HEAD ignores this query and still points at the fixture Bot.
 */
export function previewMembersRequested(value: unknown): boolean {
  return previewQueryOn(value)
}

/**
 * `?parts=1` on GET. Inserts one assistant line with a Kit button and a status.
 * HEAD ignores this query.
 */
export function previewPartsRequested(value: unknown): boolean {
  return previewQueryOn(value)
}

/**
 * `?kitchen=1` on GET. Inserts one assistant line with a Kitchen button and a status.
 * HEAD ignores this query.
 */
export function previewKitchenRequested(value: unknown): boolean {
  return previewQueryOn(value)
}

/**
 * `?threads=1` on GET. Seeds a preview Member, that Member's private Bot,
 * and separate Owner and Member lines on the shared preview Bot.
 * HEAD ignores this query.
 */
export function previewThreadsRequested(value: unknown): boolean {
  return previewQueryOn(value)
}

/**
 * `?rooms=1` on GET. Seeds the preview Member, a direct message, and a
 * room with the shared preview Bot. The room line mentions that Bot and
 * stores one reply. HEAD ignores this query.
 */
export function previewRoomsRequested(value: unknown): boolean {
  return previewQueryOn(value)
}

/** `?threads=1&as=member` signs in the preview Member. Any other value stays the Owner. */
export function previewThreadAsMember(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.includes('member')
  }
  return value === 'member'
}

/**
 * GET /preview-seed redirect.
 * `members=1` opens Members. A room opens that Thread. Threads open
 * `/` for the Owner and `/bots/<id>` for the Member. Otherwise Chat,
 * including `hold` and `activity`. Members, threads, and rooms do not
 * keep `activity`.
 */
export function previewSeedRedirect(input: {
  botId: string
  roomId?: string | null
  members?: unknown
  threads?: unknown
  rooms?: unknown
  as?: unknown
  hold?: unknown
  activity?: unknown
  target?: unknown
}): string {
  if (previewMembersRequested(input.members)) {
    return '/members'
  }
  if (previewRoomsRequested(input.rooms) && input.roomId) {
    return `/threads/${input.roomId}`
  }
  if (previewThreadsRequested(input.threads)) {
    return previewThreadAsMember(input.as) ? `/bots/${input.botId}` : '/'
  }
  return previewChatLocation(input.botId, input.hold, input.activity, input.target)
}

/** Shared by preview query flags. h3 may parse `1` as a string or a number. */
function previewQueryOn(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => item === '1' || item === 1)
  }
  return value === '1' || value === 1
}

/**
 * Fixture Bot id when that row is in `bots`.
 * Display name is ignored, including a rename away from **New Bot**.
 */
export function stablePreviewBotId(
  bots: Array<{ id: string }>,
): string | null {
  return bots.some((bot) => bot.id === PREVIEW_BOT_ID) ? PREVIEW_BOT_ID : null
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
 * Ensure the preview Owner and the fixture preview Bot (`preview`).
 * A rename or a newer Bot does not replace that Chat.
 * `tall` appends preview layout lines once.
 * `parts` appends one assistant line with Kit parts once, after the tall thread
 * so that line stays at the bottom of the Chat.
 * `kitchen` fills empty Kitchen tables and appends one Kitchen button line once,
 * after the parts line.
 * `threads` adds a preview Member, that Member's Bot, a grant for the
 * Member on Bot `preview`, and separate bot-threads.
 * `rooms` does that and adds a direct message plus a room with the shared Bot.
 * Throws OwnerAuthError 401 when the Store Owner is not this login.
 */
export async function ensurePreviewCluster(
  store: OpenedStore,
  hashPassword: (password: string) => Promise<string>,
  verifyPassword: (hash: string, password: string) => Promise<boolean>,
  options: { tall?: boolean, parts?: boolean, kitchen?: boolean, threads?: boolean, rooms?: boolean } = {},
): Promise<{ user: HostSessionUser, botId: string, member: HostSessionUser | null, roomId: string | null }> {
  const user = await ensurePreviewOwner(store, hashPassword, verifyPassword)
  const botId = stablePreviewBotId(listBots(store))
    ?? createBot(store, {
      id: PREVIEW_BOT_ID,
      name: DEFAULT_BOT_NAME,
      createdBy: user.id,
    }).bot.id
  if (options.tall) {
    ensurePreviewTallThread(store, botId, user.id)
  }
  if (options.parts) {
    ensurePreviewPartsLine(store, botId)
  }
  if (options.kitchen) {
    ensurePreviewKitchen(store, botId, user.id)
  }
  const member = options.threads || options.rooms
    ? await ensurePreviewThreads(store, hashPassword, user.id, botId)
    : null
  const roomId = options.rooms && member
    ? ensurePreviewRooms(store, user.id, member.id, botId)
    : null
  return { user, botId, member, roomId }
}

export function previewPartsContent(): string {
  return `${PREVIEW_PARTS_PREFIX}\n\nA **button** in this bubble opens a Sheet.`
}

export function previewParts(): ChatPart[] {
  return [
    { kind: 'status', label: 'Preview', tone: 'neutral' },
    {
      kind: 'button',
      label: 'Open demo',
      action: { type: 'openSheet', sheetId: HOST_DEMO_SHEET_ID },
    },
  ]
}

/**
 * Append the parts line once. The timestamp is 1ms after the latest line
 * so Chat order stays stable when inserts share `Date.now()`.
 */
export function ensurePreviewPartsLine(store: OpenedStore, botId: string): void {
  const existing = listMessages(store, botId)
  if (existing.some((message) => message.content.startsWith(PREVIEW_PARTS_PREFIX))) {
    return
  }
  let at = 0
  for (const message of existing) {
    const ms = Date.parse(message.createdAt)
    if (ms > at) {
      at = ms
    }
  }
  const message = insertMessage(store, {
    botId,
    role: 'assistant',
    content: previewPartsContent(),
    parts: previewParts(),
  })
  store.sqlite.prepare('UPDATE messages SET created_at = ? WHERE id = ?').run(at + 1, message.id)
}

export function previewKitchenContent(): string {
  return `${PREVIEW_KITCHEN_PREFIX}\n\nA **button** in this bubble opens the Kitchen Sheet.`
}

export function previewKitchenParts(): ChatPart[] {
  return [
    { kind: 'status', label: 'Kitchen', tone: 'ok' },
    {
      kind: 'button',
      label: 'Open Kitchen',
      action: { type: 'openSheet', sheetId: HOST_KITCHEN_SHEET_ID },
    },
  ]
}

/**
 * Fill empty Kitchen tables, then append the Kitchen button once.
 * A second visit does not add another Chat line or duplicate those rows.
 */
export function ensurePreviewKitchen(store: OpenedStore, botId: string, personId: string): void {
  if (listKitchenPantry(store).length === 0) {
    addKitchenPantry(store, { name: 'Eggs', qty: '6' })
    addKitchenPantry(store, { name: 'Milk' })
  }
  if (!getKitchenRecipe(store)) {
    saveKitchenRecipe(store, { name: 'Omelette', ingredients: 'eggs\nmilk' })
  }
  if (listKitchenCooked(store).length === 0) {
    markKitchenCooked(store, { label: 'Omelette', personId })
  }
  const existing = listMessages(store, botId)
  if (existing.some((message) => message.content.startsWith(PREVIEW_KITCHEN_PREFIX))) {
    return
  }
  let at = 0
  for (const message of existing) {
    const ms = Date.parse(message.createdAt)
    if (ms > at) {
      at = ms
    }
  }
  const message = appendClusterMessage(store, {
    botId,
    role: 'assistant',
    content: previewKitchenContent(),
    parts: previewKitchenParts(),
  })
  store.sqlite.prepare('UPDATE messages SET created_at = ? WHERE id = ?').run(at + 1, message.id)
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

function previewLineExists(store: OpenedStore, botId: string, prefix: string): boolean {
  return listMessages(store, botId).some((message) => message.content.startsWith(prefix))
}

/**
 * One preview Member, their private Bot, and one user line on each
 * bot-thread the demo opens. A second call does not append those lines.
 */
export async function ensurePreviewThreads(
  store: OpenedStore,
  hashPassword: (password: string) => Promise<string>,
  ownerId: string,
  sharedBotId: string,
): Promise<HostSessionUser> {
  const existing = findMemberSecretByLogin(store, PREVIEW_MEMBER_LOGIN)
  const member = existing ?? await createMember(store, {
    displayName: 'Preview Member',
    username: PREVIEW_MEMBER_LOGIN,
    passwordHash: await hashPassword(PREVIEW_MEMBER_PASSWORD),
  })
  if (!getBot(store, PREVIEW_PRIVATE_BOT_ID)) {
    createBot(store, {
      id: PREVIEW_PRIVATE_BOT_ID,
      name: PREVIEW_PRIVATE_BOT_NAME,
      createdBy: member.id,
      avatarShape: 'owl',
      avatarColor: '#8354E6',
    })
  }
  grantBot(store, sharedBotId, member.id)
  if (!previewLineExists(store, sharedBotId, PREVIEW_OWNER_THREAD_PREFIX)) {
    insertMessage(store, {
      botId: sharedBotId,
      role: 'user',
      content: PREVIEW_OWNER_THREAD_PREFIX,
      personId: ownerId,
    })
  }
  if (!previewLineExists(store, sharedBotId, PREVIEW_MEMBER_THREAD_PREFIX)) {
    insertMessage(store, {
      botId: sharedBotId,
      role: 'user',
      content: PREVIEW_MEMBER_THREAD_PREFIX,
      personId: member.id,
    })
  }
  if (!previewLineExists(store, PREVIEW_PRIVATE_BOT_ID, PREVIEW_PRIVATE_THREAD_PREFIX)) {
    insertMessage(store, {
      botId: PREVIEW_PRIVATE_BOT_ID,
      role: 'user',
      content: PREVIEW_PRIVATE_THREAD_PREFIX,
      personId: member.id,
    })
  }
  return toMemberSession(member)
}

/**
 * One direct message and one room. A second call does not append lines.
 * The room mention uses the shared Bot's current name.
 */
export function ensurePreviewRooms(
  store: OpenedStore,
  ownerId: string,
  memberId: string,
  sharedBotId: string,
): string {
  const botName = getBot(store, sharedBotId)?.name ?? 'Bot'
  createMessengerThread(store, {
    id: PREVIEW_DM_THREAD_ID,
    kind: 'dm',
    actorId: ownerId,
    personIds: [memberId],
  })
  if (!threadHasPrefix(store, PREVIEW_DM_THREAD_ID, PREVIEW_DM_PREFIX)) {
    insertThreadLine(store, {
      threadId: PREVIEW_DM_THREAD_ID,
      role: 'user',
      content: PREVIEW_DM_PREFIX,
      personId: ownerId,
    })
  }
  if (!threadHasPrefix(store, PREVIEW_DM_THREAD_ID, PREVIEW_DM_REPLY_PREFIX)) {
    insertThreadLine(store, {
      threadId: PREVIEW_DM_THREAD_ID,
      role: 'user',
      content: PREVIEW_DM_REPLY_PREFIX,
      personId: memberId,
    })
  }
  createMessengerThread(store, {
    id: PREVIEW_ROOM_THREAD_ID,
    kind: 'room',
    title: PREVIEW_ROOM_TITLE,
    actorId: ownerId,
    personIds: [memberId],
    botIds: [sharedBotId],
  })
  if (!threadHasPrefix(store, PREVIEW_ROOM_THREAD_ID, PREVIEW_ROOM_PREFIX)) {
    insertThreadLine(store, {
      threadId: PREVIEW_ROOM_THREAD_ID,
      role: 'user',
      content: `${PREVIEW_ROOM_PREFIX} @${botName} hello from the room.`,
      personId: ownerId,
    })
  }
  if (!threadHasPrefix(store, PREVIEW_ROOM_THREAD_ID, PREVIEW_ROOM_REPLY_PREFIX)) {
    insertThreadLine(store, {
      threadId: PREVIEW_ROOM_THREAD_ID,
      role: 'assistant',
      content: PREVIEW_ROOM_REPLY_PREFIX,
      botId: sharedBotId,
    })
  }
  return PREVIEW_ROOM_THREAD_ID
}

function threadHasPrefix(store: OpenedStore, threadId: string, prefix: string): boolean {
  return listThreadMessages(store, threadId).some((message) => message.content.startsWith(prefix))
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
