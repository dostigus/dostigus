import {
  LLM_GATEWAY_FAILURE_KINDS,
  llmGatewayErrorReply,
} from '@dostigus/shared'
import en from '../locales/en.json'
import ru from '../locales/ru.json'

/** Day-1 Host UI Locales. See ADR 0037. */
export const HOST_LOCALES = ['en', 'ru'] as const

export type HostLocale = (typeof HOST_LOCALES)[number]

export const DEFAULT_HOST_LOCALE: HostLocale = 'en'

/** Signed-out Host cookie. A first Member login may seed Member.locale. */
export const HOST_LOCALE_COOKIE = 'dostigus_locale'

export const HOST_LOCALE_MESSAGES = {
  en,
  ru,
} as const

export type HostLocaleMessages = typeof en

export type HostTranslateParams = Record<string, string | number>

export function isHostLocale(value: unknown): value is HostLocale {
  return value === 'en' || value === 'ru'
}

/**
 * Cookie, then Member.locale, then `en`.
 * Preview seed and shoot always force `en`.
 */
export function resolveHostLocale(input: {
  cookie?: string | null
  memberLocale?: string | null
  preview?: boolean
} = {}): HostLocale {
  if (input.preview) {
    return DEFAULT_HOST_LOCALE
  }
  if (isHostLocale(input.cookie)) {
    return input.cookie
  }
  if (isHostLocale(input.memberLocale)) {
    return input.memberLocale
  }
  return DEFAULT_HOST_LOCALE
}

export function localeMessageKeys(messages: unknown, prefix = ''): string[] {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) {
    return []
  }
  const keys: string[] = []
  for (const [key, value] of Object.entries(messages as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      keys.push(path)
    } else {
      keys.push(...localeMessageKeys(value, path))
    }
  }
  return keys.sort((left, right) => left.localeCompare(right))
}

function lookup(messages: unknown, path: string): string | undefined {
  let current: unknown = messages
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !(part in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

function interpolate(template: string, params?: HostTranslateParams): string {
  if (!params) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

/**
 * Look up a Locale dictionary string. Missing keys fall back to EN.
 * A miss in EN returns an empty string — never a raw `a.b.c` path.
 */
export function tHost(
  locale: HostLocale,
  key: string,
  params?: HostTranslateParams,
): string {
  const raw = lookup(HOST_LOCALE_MESSAGES[locale], key)
    ?? lookup(HOST_LOCALE_MESSAGES.en, key)
  if (typeof raw !== 'string') {
    return ''
  }
  return interpolate(raw, params)
}

/**
 * Map a stored gateway error bubble onto the current Locale.
 * Matches EN, RU, and the shared fallback constants so an older
 * English line follows Locale without rewriting Chat bodies.
 */
export function localizeGatewayErrorReply(
  content: string,
  locale: HostLocale,
): string {
  const trimmed = content.trim()
  if (!trimmed) {
    return content
  }
  for (const audience of ['owner', 'member'] as const) {
    for (const kind of LLM_GATEWAY_FAILURE_KINDS) {
      const key = `chat.errorGateway.${audience}.${kind}`
      if (
        trimmed === tHost('en', key)
        || trimmed === tHost('ru', key)
        || trimmed === llmGatewayErrorReply(audience, kind)
      ) {
        return tHost(locale, key)
      }
    }
  }
  return content
}
