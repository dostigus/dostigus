import type { OpenedStore } from '@dostigus/db'
import type { MessageRole } from '@dostigus/shared'
import {
  createBot,
  deleteBot,
  ensureGreeting,
  insertMessage,
  listBots,
  listMessages,
  requireBot,
  updateBot,
} from '@dostigus/db'

export type ClusterBotInput = {
  name?: string
  modelTier?: string
  avatarShape?: string
  avatarColor?: string
  label?: string
  description?: string
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
}

export function listClusterBots(store: OpenedStore) {
  return { bots: listBots(store) }
}

export function getClusterBot(store: OpenedStore, id: string) {
  return { bot: requireBot(store, id) }
}

export function createClusterBot(store: OpenedStore, input: ClusterBotInput = {}) {
  return createBot(store, input)
}

export function updateClusterBot(store: OpenedStore, id: string, input: ClusterBotInput) {
  return { bot: updateBot(store, id, input) }
}

export function deleteClusterBot(store: OpenedStore, id: string) {
  deleteBot(store, id)
  return { ok: true as const }
}

export function listClusterMessages(store: OpenedStore, botId: string) {
  ensureGreeting(store, botId)
  return { messages: listMessages(store, botId) }
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
