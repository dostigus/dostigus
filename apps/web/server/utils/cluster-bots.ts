import type { OpenedStore } from '@dostigus/db'
import type { BotViewer, MessageRole } from '@dostigus/shared'
import {
  createBot,
  deleteBot,
  insertMessage,
  listBots,
  listBotThreadMessages,
  requireBot,
  setBotVisibility,
  StoreError,
  updateBot,
} from '@dostigus/db'
import {
  botThreadPersonId,
  canDeleteBot,
  canEditBot,
  canFlipBotVisibility,
  canSeeBot,
  isBotVisibility,
} from '@dostigus/shared'

export type ClusterBotInput = {
  name?: string
  modelTier?: string
  avatarShape?: string
  avatarColor?: string
  label?: string
  description?: string
  /** Owner may pass `private`. A Member is forced to `private`. */
  visibility?: string
}

export function viewerFromUser(user: { id: string, role?: string }): BotViewer {
  return {
    id: user.id,
    role: user.role === 'member' ? 'member' : 'owner',
  }
}

export type ClusterMessageInput = {
  botId: string
  role: MessageRole
  content: string
  personId?: string | null
  /**
   * Assistant Kit parts. The Chat reply path and `dostigus_messages_create`
   * leave this empty. Preview `?kitchen=1` calls this with the Kitchen
   * button. See ADR 0025 and ADR 0026.
   */
  parts?: unknown
  /** The person whose bot-thread this line belongs on. */
  viewer?: BotViewer
}

function assertVisible(store: OpenedStore, id: string, viewer: BotViewer) {
  const bot = requireBot(store, id)
  if (!canSeeBot(bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
  return bot
}

export function listClusterBots(store: OpenedStore, viewer?: BotViewer) {
  return { bots: listBots(store, viewer) }
}

export function getClusterBot(store: OpenedStore, id: string, viewer?: BotViewer) {
  const bot = requireBot(store, id)
  if (viewer && !canSeeBot(bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
  return { bot }
}

export function createClusterBot(
  store: OpenedStore,
  input: ClusterBotInput = {},
  viewer?: BotViewer,
) {
  if (viewer?.role === 'member') {
    if (input.visibility != null && input.visibility !== '' && input.visibility !== 'private') {
      throw new StoreError('A Member can create only a private Bot', 403)
    }
    return createBot(store, {
      ...input,
      visibility: 'private',
      createdBy: viewer.id,
    })
  }
  return createBot(store, {
    ...input,
    visibility: input.visibility,
    createdBy: viewer?.id,
  })
}

export function updateClusterBot(
  store: OpenedStore,
  id: string,
  input: ClusterBotInput,
  viewer?: BotViewer,
) {
  if (viewer) {
    const bot = assertVisible(store, id, viewer)
    if (!canEditBot(bot, viewer)) {
      throw new StoreError('Only the Owner can change this', 403)
    }
  }
  return { bot: updateBot(store, id, input) }
}

export function deleteClusterBot(store: OpenedStore, id: string, viewer?: BotViewer) {
  if (viewer) {
    const bot = assertVisible(store, id, viewer)
    if (!canDeleteBot(bot, viewer)) {
      throw new StoreError('Only the Owner can change this', 403)
    }
  }
  deleteBot(store, id)
  return { ok: true as const }
}

/** Owner-only. A flip keeps the creator. */
export function setClusterBotVisibility(
  store: OpenedStore,
  id: string,
  visibility: string | undefined,
  viewer: BotViewer,
) {
  if (!canFlipBotVisibility(viewer)) {
    throw new StoreError('Only the Owner can change this', 403)
  }
  assertVisible(store, id, viewer)
  if (!visibility || !isBotVisibility(visibility)) {
    throw new StoreError('Unknown Bot visibility', 400)
  }
  return { bot: setBotVisibility(store, id, visibility) }
}

export function listClusterMessages(store: OpenedStore, botId: string, viewer?: BotViewer) {
  const bot = requireBot(store, botId)
  if (viewer && !canSeeBot(bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
  const personId = viewer
    ? botThreadPersonId(bot, viewer)
    : (bot.visibility === 'private' ? bot.createdBy : null)
  return { messages: listBotThreadMessages(store, botId, personId) }
}

export function appendClusterMessage(store: OpenedStore, input: ClusterMessageInput) {
  return insertMessage(store, input)
}

export function withClusterStore<T>(fn: (store: OpenedStore) => T): T {
  try {
    return fn(useStore())
  } catch (error) {
    throwStoreError(error)
  }
}
