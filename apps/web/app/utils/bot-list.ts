import type { BotListItem } from '@dostigus/shared'

const AVATAR_COLORS = [
  '#c4563a',
  '#d4893a',
  '#c4a15a',
  '#3f8f78',
  '#3d7ea6',
  '#6d63b8',
  '#b85c78',
  '#8d8478',
] as const

export function filterBots(bots: readonly BotListItem[], query: string): BotListItem[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return [...bots]
  }
  return bots.filter((bot) => {
    if (bot.name.toLowerCase().includes(needle)) {
      return true
    }
    return bot.lastMessage?.content.toLowerCase().includes(needle) ?? false
  })
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return '?'
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase()
  }
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

export function avatarColor(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}
