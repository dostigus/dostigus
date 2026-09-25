import type { OpenedStore, TurnTrigger } from '@dostigus/db'
import type { AssistantReplyVia, ModelTier } from '@dostigus/shared'
import type { ChatActivityPhase } from '../../app/utils/chat-activity'
import { appendTurnPhase, appendTurnTool, finishTurn, patchTurnObservability, startTurn } from '@dostigus/db'
import { setChatActivityPhaseListener } from './chat-activity-phase'

type ActiveTurn = {
  store: OpenedStore
  turnId: string
}

const active = new Map<string, ActiveTurn>()
const keyByTurn = new Map<string, string>()

function phaseKey(threadId: string, botId: string): string {
  return `${threadId}\0${botId}`
}

function unbindTurn(turnId: string): void {
  const key = keyByTurn.get(turnId)
  if (!key) {
    return
  }
  keyByTurn.delete(turnId)
  const current = active.get(key)
  if (current?.turnId === turnId) {
    active.delete(key)
  }
}

setChatActivityPhaseListener((threadId, botId, phase) => {
  noteTurnPhase(threadId, botId, phase)
})

function noteTurnPhase(threadId: string, botId: string, phase: ChatActivityPhase): void {
  const current = active.get(phaseKey(threadId, botId))
  if (!current) {
    return
  }
  try {
    appendTurnPhase(current.store, current.turnId, { phase, at: Date.now() })
  } catch {
    console.warn('Turn journal phase write failed')
  }
}

export function beginChatTurn(
  store: OpenedStore,
  input: {
    threadId: string
    botId: string
    personId: string
    trigger: TurnTrigger
    scheduleId?: string | null
    now?: number
  },
): string {
  const turn = startTurn(store, input)
  const key = phaseKey(input.threadId, input.botId)
  active.set(key, { store, turnId: turn.id })
  keyByTurn.set(turn.id, key)
  return turn.id
}

export function noteChatTurnObservability(
  threadId: string,
  botId: string,
  note: { modelId: string, modelTier: ModelTier, visionParts: boolean },
): void {
  const current = active.get(phaseKey(threadId, botId))
  if (!current) {
    return
  }
  try {
    patchTurnObservability(current.store, current.turnId, note)
  } catch {
    console.warn('Turn journal observability write failed')
  }
}

export function recordChatTurnTool(
  threadId: string,
  botId: string,
  entry: { name: string, ok: boolean, ms: number },
): void {
  const current = active.get(phaseKey(threadId, botId))
  if (!current) {
    return
  }
  try {
    appendTurnTool(current.store, current.turnId, entry)
  } catch {
    console.warn('Turn journal tool write failed')
  }
}

export type TurnSettle
  = | { outcome: 'ok' }
    | { outcome: 'error', errorCode?: 'llm_error' | 'tool_error' | null }
    | { outcome: 'abort' }

export function settleChatTurn(store: OpenedStore, turnId: string, settle: TurnSettle): void {
  if (!turnId) {
    return
  }
  try {
    if (settle.outcome === 'ok') {
      finishTurn(store, turnId, { outcome: 'ok', errorCode: null })
      return
    }
    if (settle.outcome === 'abort') {
      finishTurn(store, turnId, { outcome: 'abort', errorCode: 'aborted' })
      return
    }
    finishTurn(store, turnId, {
      outcome: 'error',
      errorCode: settle.errorCode ?? null,
    })
  } catch {
    console.warn('Turn journal finalize failed')
  } finally {
    unbindTurn(turnId)
  }
}

export class TurnToolError extends Error {
  readonly turnErrorCode = 'tool_error' as const

  constructor() {
    super('tool failed')
    this.name = 'TurnToolError'
  }
}

export function requestAborted(event: { node?: { req?: { aborted?: boolean } } }): boolean {
  return event.node?.req?.aborted === true
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  const name = 'name' in error ? String(error.name) : ''
  const code = 'code' in error ? String(error.code) : ''
  return name === 'AbortError' || code === 'ABORT_ERR'
}

function isToolTurnError(error: unknown): boolean {
  return error instanceof TurnToolError
    || (typeof error === 'object' && error !== null && 'turnErrorCode' in error && error.turnErrorCode === 'tool_error')
}

export function settleFromReply(input: {
  via?: AssistantReplyVia
  error?: unknown
  aborted?: boolean
}): TurnSettle {
  if (input.aborted || isAbortError(input.error)) {
    return { outcome: 'abort' }
  }
  if (input.error) {
    return {
      outcome: 'error',
      errorCode: isToolTurnError(input.error) ? 'tool_error' : 'llm_error',
    }
  }
  if (input.via === 'error') {
    return { outcome: 'error', errorCode: 'llm_error' }
  }
  return { outcome: 'ok' }
}

/** Test isolation. Drops in-memory bindings. Store rows stay. */
export function resetChatTurnJournal(): void {
  active.clear()
  keyByTurn.clear()
}
