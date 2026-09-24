import type { OpenedStore } from '@dostigus/db'
import type { BotViewer } from '@dostigus/shared'
import type { ChatActivityPhase } from '../../app/utils/chat-activity'
import {
  botThreadIdFor,
  getBot,
  getMessengerThread,
  listMessengerBots,
  StoreError,
  viewerMaySeeBot,
} from '@dostigus/db'
import { isChatActivityPhase } from '../../app/utils/chat-activity'

/**
 * Ephemeral Activity phase for an in-flight reply. Keyed by Thread and
 * Bot. The poll reads this map, not the Turn journal. See ADR 0021 and
 * ADR 0029.
 */
const phases = new Map<string, ChatActivityPhase>()

type PhaseListener = (threadId: string, botId: string, phase: ChatActivityPhase) => void

let phaseListener: PhaseListener | undefined

function phaseKey(threadId: string, botId: string): string {
  return `${threadId}\0${botId}`
}

/** Dual-write hook. The Turn journal registers this. The poll does not. */
export function setChatActivityPhaseListener(listener: PhaseListener | undefined): void {
  phaseListener = listener
}

export function setChatActivityPhase(
  threadId: string,
  botId: string,
  phase: ChatActivityPhase,
): void {
  if (!threadId || !botId || !isChatActivityPhase(phase)) {
    return
  }
  phases.set(phaseKey(threadId, botId), phase)
  phaseListener?.(threadId, botId, phase)
}

export function clearChatActivityPhase(threadId: string, botId: string): void {
  if (!threadId || !botId) {
    return
  }
  phases.delete(phaseKey(threadId, botId))
}

export function readChatActivityPhase(
  threadId: string,
  botId: string,
): ChatActivityPhase | null {
  return phases.get(phaseKey(threadId, botId)) ?? null
}

/** Test isolation. The map lives for the Host process. */
export function clearChatActivityPhases(): void {
  phases.clear()
}

export function messageThreadId(store: OpenedStore, messageId: string): string {
  const row = store.sqlite.prepare(`
    SELECT thread_id FROM messages WHERE id = ?
  `).get(messageId) as { thread_id: string | null } | undefined
  const threadId = row?.thread_id
  if (!threadId) {
    throw new StoreError('Thread not found', 404)
  }
  return threadId
}

type ThreadRow = {
  id: string
  kind: string
  bot_id: string | null
}

function personOnThread(store: OpenedStore, threadId: string, personId: string): boolean {
  const row = store.sqlite.prepare(`
    SELECT 1 AS ok FROM thread_participants
    WHERE thread_id = ? AND kind = 'person' AND ref_id = ?
  `).get(threadId, personId) as { ok: number } | undefined
  return Boolean(row)
}

/**
 * Current phase for a Thread the viewer can already open in Chat.
 * A bot-thread is that person's own. A room is a mention-reply.
 * Missing phase is idle (`null`). Connect is never stored.
 */
export function readThreadChatActivity(
  store: OpenedStore,
  input: { viewer: BotViewer, threadId: string, botId: string },
): { phase: ChatActivityPhase | null } {
  const threadId = input.threadId.trim()
  const botId = input.botId.trim()
  if (!threadId || !botId) {
    throw new StoreError('Thread not found', 404)
  }
  const bot = getBot(store, botId)
  if (!bot || !viewerMaySeeBot(store, bot, input.viewer)) {
    throw new StoreError('Thread not found', 404)
  }

  const thread = store.sqlite.prepare(`
    SELECT id, kind, bot_id FROM threads WHERE id = ?
  `).get(threadId) as ThreadRow | undefined

  if (!thread) {
    if (threadId === botThreadIdFor(botId, input.viewer.id)) {
      return { phase: null }
    }
    throw new StoreError('Thread not found', 404)
  }

  if (thread.kind === 'bot') {
    if (thread.bot_id !== botId || !personOnThread(store, threadId, input.viewer.id)) {
      throw new StoreError('Thread not found', 404)
    }
    return { phase: readChatActivityPhase(threadId, botId) }
  }

  if (thread.kind === 'room') {
    getMessengerThread(store, threadId, input.viewer.id)
    const bots = listMessengerBots(store, threadId, input.viewer.id)
    if (!bots.some((roomBot) => roomBot.id === botId)) {
      throw new StoreError('Thread not found', 404)
    }
    return { phase: readChatActivityPhase(threadId, botId) }
  }

  throw new StoreError('Thread not found', 404)
}
