/**
 * Kit parts on an assistant Chat line. User and system lines have none.
 * See ADR 0025. Markdown stays in `content` (ADR 0022).
 */

export const CHAT_PART_STATUS_TONES = ['neutral', 'ok', 'warn'] as const

export type ChatPartStatusTone = (typeof CHAT_PART_STATUS_TONES)[number]

export const CHAT_PART_LABEL_MAX = 80
export const CHAT_PARTS_MAX = 8

/** Host registry id. Lowercase, so a later Module can add `pantry` without a new column. */
const SHEET_ID = /^[a-z][a-z0-9-]{0,63}$/

export type ChatPartButtonAction = {
  type: 'openSheet'
  sheetId: string
}

export type ChatPartButton = {
  kind: 'button'
  label: string
  action: ChatPartButtonAction
}

export type ChatPartStatus = {
  kind: 'status'
  label: string
  tone: ChatPartStatusTone
}

export type ChatPart = ChatPartButton | ChatPartStatus

function isTone(value: unknown): value is ChatPartStatusTone {
  return (CHAT_PART_STATUS_TONES as readonly unknown[]).includes(value)
}

function parseLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const label = value.trim()
  if (!label || label.length > CHAT_PART_LABEL_MAX) {
    return null
  }
  return label
}

function parsePart(value: unknown): ChatPart | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const item = value as Record<string, unknown>
  const label = parseLabel(item.label)
  if (!label) {
    return null
  }
  if (item.kind === 'status') {
    if (!isTone(item.tone)) {
      return null
    }
    return { kind: 'status', label, tone: item.tone }
  }
  if (item.kind !== 'button') {
    return null
  }
  const action = item.action
  if (!action || typeof action !== 'object') {
    return null
  }
  const record = action as Record<string, unknown>
  if (record.type !== 'openSheet' || typeof record.sheetId !== 'string' || !SHEET_ID.test(record.sheetId)) {
    return null
  }
  return {
    kind: 'button',
    label,
    action: { type: 'openSheet', sheetId: record.sheetId },
  }
}

/** Drop unknown kinds and invalid rows. Caps the list. */
export function parseChatParts(raw: unknown): ChatPart[] {
  let value = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) {
      return []
    }
    try {
      value = JSON.parse(raw) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) {
    return []
  }
  const parts: ChatPart[] = []
  for (const item of value) {
    if (parts.length >= CHAT_PARTS_MAX) {
      break
    }
    const part = parsePart(item)
    if (part) {
      parts.push(part)
    }
  }
  return parts
}

/** User and system lines never carry parts, even if a writer passed some. */
export function chatPartsForRole(role: string, raw: unknown): ChatPart[] {
  if (role !== 'assistant') {
    return []
  }
  return parseChatParts(raw)
}

export function serializeChatParts(role: string, raw: unknown): string {
  return JSON.stringify(chatPartsForRole(role, raw))
}
