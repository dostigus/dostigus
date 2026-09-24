/**
 * Chat LLM history window and keyword expand. See ADR 0032.
 */

import type { MessageRole } from './types'

export const CHAT_LLM_HISTORY_LIMIT = 40

const CHAT_EXPAND_SUBSTRINGS = [
  'name',
  'rename',
  'название',
  'имя',
  'label',
  'метка',
  'description',
  'описание',
  'skill',
  'skills',
  'навык',
  'allowlist',
  'marketplace',
  'timezone',
  'self-settings',
  'настрой бота',
  'параметры',
] as const

/** Prefix: `таймзона` and `таймзону` match. */
const CHAT_EXPAND_PREFIXES = ['таймзон'] as const

export type ChatLlmHistoryMessage = {
  id?: string
  role: MessageRole
  content: string
}

/**
 * Last 40 stored lines (`role` + `content`). Always includes the triggering
 * user or Wake line when that line would fall outside the window.
 */
export function chatLlmHistory(
  history: ChatLlmHistoryMessage[],
  trigger?: ChatLlmHistoryMessage | null,
): Array<{ role: MessageRole, content: string }> {
  const window = history.slice(-CHAT_LLM_HISTORY_LIMIT)
  const hasTrigger = !trigger || window.some((message) => sameHistoryLine(message, trigger))
  const rows = hasTrigger || !trigger ? window : [trigger, ...window]
  return rows.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

function sameHistoryLine(message: ChatLlmHistoryMessage, trigger: ChatLlmHistoryMessage): boolean {
  if (trigger.id && message.id) {
    return message.id === trigger.id
  }
  return message.role === trigger.role && message.content === trigger.content
}

/**
 * Case-insensitive substring match on this user line only.
 * A hit expands that actor's builder tools for this turn. Not a Wake.
 */
export function chatExpandKeywordHit(content: string): boolean {
  const haystack = content.toLocaleLowerCase()
  if (!haystack.trim()) {
    return false
  }
  for (const needle of CHAT_EXPAND_SUBSTRINGS) {
    if (haystack.includes(needle)) {
      return true
    }
  }
  for (const prefix of CHAT_EXPAND_PREFIXES) {
    if (haystack.includes(prefix)) {
      return true
    }
  }
  return false
}
