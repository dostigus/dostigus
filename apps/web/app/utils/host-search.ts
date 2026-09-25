import type { HostLocale } from '@dostigus/ui-kit/locale'
import { DEFAULT_HOST_LOCALE, tHost } from '@dostigus/ui-kit/locale'

const SHORTCUT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export type HostSearchBot = {
  id: string
  name: string
  lastMessage: { content: string } | null
}

export type HostSearchMessage = {
  id: string
  botId: string | null
  botName: string
  content: string
  href?: string | null
}

export type HostSearchSettingsEntry = {
  id: string
  title: string
  subtitle: string
  keywords: readonly string[]
  href: string | null
  botId: string | null
}

export type HostSearchHit = {
  key: string
  kind: 'bot' | 'message' | 'settings'
  title: string
  subtitle: string
  tag: string | null
  shortcut: string | null
  botId: string | null
  href: string | null
}

function shortcutFor(index: number, needle: string): string | null {
  if (needle || index >= SHORTCUT_KEYS.length) {
    return null
  }
  const key = SHORTCUT_KEYS[index]
  return key ? `⌘${key}` : null
}

/** Host settings rows the search Sheet can open. Owner-only pages stay out for a Member. */
export function hostSettingsCatalog(input: {
  isOwner: boolean
  bot: { id: string, name: string } | null
  locale?: HostLocale
}): HostSearchSettingsEntry[] {
  const locale = input.locale ?? DEFAULT_HOST_LOCALE
  const entries: HostSearchSettingsEntry[] = []
  if (input.isOwner) {
    entries.push(
      {
        id: 'settings',
        title: tHost(locale, 'host.search.settingsProviders'),
        subtitle: tHost(locale, 'host.search.settingsProvidersHint'),
        keywords: ['settings', 'provider', 'openrouter', 'api key', 'model', 'model tier', 'gateway', 'провайдеры'],
        href: '/dashboard/providers',
        botId: null,
      },
      {
        id: 'settings-other',
        title: tHost(locale, 'host.search.settingsOther'),
        subtitle: tHost(locale, 'host.search.settingsOtherHint'),
        keywords: ['settings', 'timezone', 'allowlist', 'http', 'прочее'],
        href: '/dashboard/cluster',
        botId: null,
      },
      {
        id: 'members',
        title: tHost(locale, 'host.search.members'),
        subtitle: tHost(locale, 'host.search.membersHint'),
        keywords: ['household', 'member'],
        href: '/members',
        botId: null,
      },
    )
  }
  if (input.bot) {
    entries.push({
      id: 'bot-settings',
      title: tHost(locale, 'host.search.botSettings'),
      subtitle: tHost(locale, 'host.search.botSettingsHint', { name: input.bot.name }),
      keywords: ['appearance', 'rename', 'avatar', 'color', 'name', 'label', 'description', 'параметры'],
      href: null,
      botId: input.bot.id,
    })
  }
  return entries
}

/**
 * Empty query lists Bots (with ⌘1–⌘9 on the first nine).
 * A query matches Bot names, Chat lines, and settings titles or keywords.
 */
export function hostSearchHits(input: {
  query: string
  bots: readonly HostSearchBot[]
  messages: readonly HostSearchMessage[]
  settings: readonly HostSearchSettingsEntry[]
  locale?: HostLocale
}): HostSearchHit[] {
  const locale = input.locale ?? DEFAULT_HOST_LOCALE
  const needle = input.query.trim().toLowerCase()
  const bots = needle
    ? input.bots.filter((bot) => bot.name.toLowerCase().includes(needle))
    : input.bots
  const botHits: HostSearchHit[] = bots.map((bot, index) => ({
    key: `bot:${bot.id}`,
    kind: 'bot',
    title: bot.name,
    subtitle: bot.lastMessage?.content ?? '',
    tag: null,
    shortcut: shortcutFor(index, needle),
    botId: bot.id,
    href: null,
  }))
  if (!needle) {
    return botHits
  }
  const messageHits: HostSearchHit[] = input.messages
    .filter((message) => message.content.toLowerCase().includes(needle))
    .slice(0, 8)
    .map((message) => ({
      key: `message:${message.id}`,
      kind: 'message',
      title: message.botName,
      subtitle: message.content,
      tag: tHost(locale, 'host.search.tagChat'),
      shortcut: null,
      botId: message.botId,
      href: message.href ?? (message.botId ? `/bots/${message.botId}` : null),
    }))
  const settingHits: HostSearchHit[] = input.settings
    .filter((entry) => `${entry.title} ${entry.keywords.join(' ')}`.toLowerCase().includes(needle))
    .map((entry) => ({
      key: `settings:${entry.id}`,
      kind: 'settings',
      title: entry.title,
      subtitle: entry.subtitle,
      tag: tHost(locale, 'host.search.tagSettings'),
      shortcut: null,
      botId: entry.botId,
      href: entry.href,
    }))
  return [...botHits, ...messageHits, ...settingHits]
}

/** 0-based index for ⌘1–⌘9, or null. */
export function hostSearchShortcutIndex(key: string): number | null {
  const index = SHORTCUT_KEYS.indexOf(key as typeof SHORTCUT_KEYS[number])
  return index === -1 ? null : index
}
