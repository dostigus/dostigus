/**
 * Kit parts on an assistant Chat line. User and system lines have none.
 * See ADR 0025. A Chat Card (`kind: card`) is ADR 0030.
 * Markdown stays in `content` (ADR 0022).
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

/**
 * Host-built Chat Card. The model does not emit this. See ADR 0030.
 * `schedule` is a Schedule change. `skill` is a Skill upsert or delete.
 * `bot` is the self-settings Card after name, label, or description.
 */
export const CHAT_CARD_KINDS = ['schedule', 'skill', 'bot'] as const

export type ChatCardKind = (typeof CHAT_CARD_KINDS)[number]

export type ChatPartCardAction = {
  label: string
  action: ChatPartButtonAction
}

export type ChatPartCard = {
  kind: 'card'
  card: ChatCardKind
  title: string
  body: string
  tone: ChatPartStatusTone
  /** Schedule id, Skill id, or Bot id. */
  targetId: string
  actions: ChatPartCardAction[]
}

export type ChatPart = ChatPartButton | ChatPartStatus | ChatPartCard

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

function isCardKind(value: unknown): value is ChatCardKind {
  return (CHAT_CARD_KINDS as readonly unknown[]).includes(value)
}

function parseTargetId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const targetId = value.trim()
  if (targetId.length > CHAT_PART_LABEL_MAX) {
    return null
  }
  return targetId
}

function parseCardActions(value: unknown): ChatPartCardAction[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const actions: ChatPartCardAction[] = []
  for (const item of value) {
    if (actions.length >= 4) {
      break
    }
    if (!item || typeof item !== 'object') {
      continue
    }
    const record = item as Record<string, unknown>
    const label = parseLabel(record.label)
    const action = record.action
    if (!label || !action || typeof action !== 'object') {
      continue
    }
    const sheet = action as Record<string, unknown>
    if (sheet.type !== 'openSheet' || typeof sheet.sheetId !== 'string' || !SHEET_ID.test(sheet.sheetId)) {
      continue
    }
    actions.push({
      label,
      action: { type: 'openSheet', sheetId: sheet.sheetId },
    })
  }
  return actions
}

function parseCard(item: Record<string, unknown>): ChatPartCard | null {
  if (!isCardKind(item.card) || !isTone(item.tone)) {
    return null
  }
  const title = parseLabel(item.title)
  const body = parseLabel(item.body)
  const targetId = parseTargetId(item.targetId)
  const actions = parseCardActions(item.actions)
  if (!title || !body || targetId === null || !actions) {
    return null
  }
  return {
    kind: 'card',
    card: item.card,
    title,
    body,
    tone: item.tone,
    targetId,
    actions,
  }
}

function parsePart(value: unknown): ChatPart | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const item = value as Record<string, unknown>
  if (item.kind === 'card') {
    return parseCard(item)
  }
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
