/**
 * In-thread Chat activity row. Copy is Russian Host chrome.
 * The message route only tells the Host that a reply is in flight, so a
 * configured wait is «Печатает…». Command and connect render when a local
 * preview query forces them. See ADR 0021.
 */

export const CHAT_ACTIVITY_KINDS = ['typing', 'command', 'connect'] as const

export type ChatActivityKind = typeof CHAT_ACTIVITY_KINDS[number]

export const CHAT_ACTIVITY_TYPING = 'Печатает…'
export const CHAT_ACTIVITY_COMMAND = 'Ожидает завершения команды'
export const CHAT_ACTIVITY_CONNECT = 'Подключается…'

export type ChatActivity = {
  kind: ChatActivityKind
  label: string
}

const CONNECT_TARGET_MAX = 48

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

/**
 * One row, or nothing.
 * A configured reply in flight is typing. No key stays quiet here so the
 * caller can keep the existing think mark. `forced` is the local preview
 * override and wins over the live flags.
 */
export function chatActivityStatus(input: {
  pending: boolean
  gatewayConfigured: boolean
  forced?: ChatActivityKind | null
  connectTarget?: string | null
}): ChatActivity | null {
  const kind = input.forced
    ?? (input.pending && input.gatewayConfigured ? 'typing' : null)
  if (!kind) {
    return null
  }
  if (kind === 'command') {
    return { kind, label: CHAT_ACTIVITY_COMMAND }
  }
  if (kind === 'connect') {
    return { kind, label: connectActivityLabel(input.connectTarget) }
  }
  return { kind: 'typing', label: CHAT_ACTIVITY_TYPING }
}
