import type { BotAccentHex, BotAvatarShape } from './bot-avatar'
import type { BotLastMessage } from './types'

/** One Thread. The kind is a label, not a separate product. See ADR 0024. */
export const THREAD_KINDS = ['dm', 'group', 'bot', 'room'] as const

export type ThreadKind = (typeof THREAD_KINDS)[number]

/** Messenger Threads. A bot-thread stays on the Bot Chat route. */
export const MESSENGER_THREAD_KINDS = ['dm', 'group', 'room'] as const

export type MessengerThreadKind = (typeof MESSENGER_THREAD_KINDS)[number]

export const THREAD_TITLE_MAX = 80

export function isThreadKind(value: string): value is ThreadKind {
  return (THREAD_KINDS as readonly string[]).includes(value)
}

export function isMessengerThreadKind(value: string): value is MessengerThreadKind {
  return (MESSENGER_THREAD_KINDS as readonly string[]).includes(value)
}

export type HouseholdPerson = {
  id: string
  displayName: string
  role: 'owner' | 'member'
}

export type ThreadParticipantView = {
  kind: 'person' | 'bot'
  id: string
  name: string
  avatarShape?: BotAvatarShape
  avatarColor?: BotAccentHex
}

/** Sidebar mark. A Bot uses the flock. A person Thread uses initials. */
export type ThreadMark = {
  type: 'bot' | 'initials'
  name: string
  seed: string
  shape?: BotAvatarShape
  color?: BotAccentHex
}

/** One row in the Threads inbox. */
export type ThreadListItem = {
  id: string
  kind: ThreadKind
  title: string
  /** Set on a bot-thread. A room keeps its Bots on participants. */
  botId: string | null
  href: string
  createdAt: string
  lastMessage: BotLastMessage | null
  participants: ThreadParticipantView[]
  mark: ThreadMark
}

/**
 * Which room Bot a line invokes.
 *
 * The mention is `@` plus that Bot's name, case-insensitive. A space or
 * the start of the line comes before `@`. A space, the end of the line,
 * or `. , ! ? ; :` comes after the name. The earliest `@` wins. When two
 * Bot names start at that same `@`, the longer name wins. One Bot per line.
 *
 * A dm or a group never invokes a Bot. `listen=all` is not this rule.
 * See ADR 0024.
 */
export function mentionedRoomBot<T extends { id: string, name: string }>(
  content: string,
  bots: readonly T[],
): T | null {
  let best: { bot: T, index: number, length: number } | null = null
  for (const bot of bots) {
    const name = bot.name.trim()
    if (!name) {
      continue
    }
    const pattern = new RegExp(
      `(^|\\s)@${escapeRegExp(name)}(?=$|[\\s.,!?;:])`,
      'i',
    )
    const match = pattern.exec(content)
    if (!match) {
      continue
    }
    const index = match.index + (match[1]?.length ?? 0)
    if (
      !best
      || index < best.index
      || (index === best.index && name.length > best.length)
    ) {
      best = { bot, index, length: name.length }
    }
  }
  return best?.bot ?? null
}

/** The `@` token that ends at the caret: where `@` sits and the text typed after it. */
export type RoomMentionQuery = {
  at: number
  query: string
}

/**
 * The `@` the room picker filters on. `@` must start the line or follow
 * whitespace, the same as `mentionedRoomBot`, and the text from `@` to the
 * caret stays on one line. The query may hold spaces, so a name such as
 * `New Bot` still filters after `@New B`.
 */
export function roomMentionQuery(text: string, caret: number): RoomMentionQuery | null {
  const before = text.slice(0, Math.max(0, caret))
  const at = before.lastIndexOf('@')
  if (at < 0) {
    return null
  }
  if (at > 0 && !/\s/.test(before[at - 1] ?? '')) {
    return null
  }
  const query = before.slice(at + 1)
  if (query.includes('\n')) {
    return null
  }
  return { at, query }
}

/** Bots whose name starts with the query, or with a word in it when the query is one word. */
export function roomMentionMatches<T extends { name: string }>(bots: readonly T[], query: string): T[] {
  const needle = query.toLowerCase()
  const oneWord = !/\s/.test(needle)
  return bots.filter((bot) => {
    const name = bot.name.trim().toLowerCase()
    if (!name) {
      return false
    }
    return name.startsWith(needle) || (oneWord && name.split(/\s+/).some((word) => word.startsWith(needle)))
  })
}

/**
 * Replace the `@` token up to the caret with `@` plus the Bot name, in the
 * form `mentionedRoomBot` matches. A space follows unless the next
 * character already ends the mention.
 */
export function insertRoomMention(
  text: string,
  mention: RoomMentionQuery,
  name: string,
): { text: string, caret: number } {
  const label = `@${name.trim()}`
  const end = mention.at + 1 + mention.query.length
  const after = text.slice(end)
  const gap = /^[\s.,!?;:]/.test(after) ? '' : ' '
  const next = `${text.slice(0, mention.at)}${label}${gap}${after}`
  const caret = mention.at + label.length + (gap || /^\s/.test(after) ? 1 : 0)
  return { text: next, caret }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
