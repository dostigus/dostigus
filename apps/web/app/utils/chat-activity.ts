/**
 * In-thread Chat activity row. Copy is Russian Host chrome.
 * A configured reply polls an Activity phase: thinking, tool, then typing.
 * Command and connect render when a local preview query forces them.
 * With no key the caller keeps the flock mark and this row stays hidden.
 * See ADR 0021.
 */

export const CHAT_ACTIVITY_PHASES = ['thinking', 'tool', 'typing'] as const

export type ChatActivityPhase = typeof CHAT_ACTIVITY_PHASES[number]

/** Preview query values. `command` draws the tool glyph and copy. */
export const CHAT_ACTIVITY_KINDS = ['thinking', 'tool', 'typing', 'command', 'connect'] as const

export type ChatActivityKind = typeof CHAT_ACTIVITY_KINDS[number]

export const CHAT_ACTIVITY_THINKING = 'Думает…'
export const CHAT_ACTIVITY_TOOL = 'Выполняет команду…'
export const CHAT_ACTIVITY_TYPING = 'Печатает…'
export const CHAT_ACTIVITY_CONNECT = 'Подключается…'

/** Open Thread poll interval while the viewer's own reply is in flight. */
export const CHAT_ACTIVITY_POLL_MS = 400

/** Keep a phase on screen at least this long so the row does not flicker. */
export const CHAT_ACTIVITY_PHASE_MIN_MS = 300

export type ChatActivityKindShown = 'thinking' | 'tool' | 'typing' | 'connect'

export type ChatActivity = {
  kind: ChatActivityKindShown
  label: string
}

const CONNECT_TARGET_MAX = 48

export function isChatActivityPhase(value: unknown): value is ChatActivityPhase {
  return typeof value === 'string'
    && (CHAT_ACTIVITY_PHASES as readonly string[]).includes(value)
}

export function parseChatActivityKind(value: unknown): ChatActivityKind | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') {
    return null
  }
  return (CHAT_ACTIVITY_KINDS as readonly string[]).includes(raw)
    ? raw as ChatActivityKind
    : null
}

/** «Подключается к {name}» when a short target is known. */
export function connectActivityLabel(target?: string | null): string {
  const name = target?.trim().replace(/\s+/g, ' ') ?? ''
  if (!name) {
    return CHAT_ACTIVITY_CONNECT
  }
  const short = name.length > CONNECT_TARGET_MAX
    ? `${name.slice(0, CONNECT_TARGET_MAX).trimEnd()}…`
    : name
  return `Подключается к ${short}`
}

function activityForKind(
  kind: ChatActivityKind,
  connectTarget?: string | null,
): ChatActivity {
  if (kind === 'command' || kind === 'tool') {
    return { kind: 'tool', label: CHAT_ACTIVITY_TOOL }
  }
  if (kind === 'connect') {
    return { kind: 'connect', label: connectActivityLabel(connectTarget) }
  }
  if (kind === 'thinking') {
    return { kind: 'thinking', label: CHAT_ACTIVITY_THINKING }
  }
  return { kind: 'typing', label: CHAT_ACTIVITY_TYPING }
}

/**
 * One row, or nothing.
 * A configured reply in flight follows `phase` (thinking until a poll
 * says otherwise). No key stays quiet here so the caller can keep the
 * existing think mark. `forced` is the local preview override and wins
 * over the live flags.
 */
export function chatActivityStatus(input: {
  pending: boolean
  gatewayConfigured: boolean
  phase?: ChatActivityPhase | null
  forced?: ChatActivityKind | null
  connectTarget?: string | null
}): ChatActivity | null {
  if (input.forced) {
    return activityForKind(input.forced, input.connectTarget)
  }
  if (!input.pending || !input.gatewayConfigured) {
    return null
  }
  return activityForKind(input.phase ?? 'thinking', null)
}

export type ChatActivityClock = {
  shown: ChatActivityPhase | null
  shownAt: number
  queued: ChatActivityPhase | null
}

/**
 * Hold the phase on screen for about 300ms. A null poll keeps the
 * current phase; the caller hides the row when the reply lands.
 */
export function noteChatActivityPhase(
  clock: ChatActivityClock,
  next: ChatActivityPhase | null,
  now: number,
  minMs = CHAT_ACTIVITY_PHASE_MIN_MS,
): { clock: ChatActivityClock, waitMs: number | null } {
  if (!next || next === clock.shown) {
    return {
      clock: { ...clock, queued: null },
      waitMs: null,
    }
  }
  if (!clock.shown || now - clock.shownAt >= minMs) {
    return {
      clock: { shown: next, shownAt: now, queued: null },
      waitMs: null,
    }
  }
  return {
    clock: { ...clock, queued: next },
    waitMs: minMs - (now - clock.shownAt),
  }
}
