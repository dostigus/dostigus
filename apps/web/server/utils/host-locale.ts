import type { OpenedStore } from '@dostigus/db'
import type { HostLocale } from '@dostigus/ui-kit/locale'
import process from 'node:process'
import { getMember } from '@dostigus/db'
import {
  DEFAULT_HOST_LOCALE,
  HOST_LOCALE_COOKIE,
  isHostLocale,
  resolveHostLocale,
} from '@dostigus/ui-kit/locale'
import { readOwnerSession } from './owner-session'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isPreviewLocaleForced(): boolean {
  return process.env.DOSTIGUS_PREVIEW_SEED === '1'
}

export function readLocaleCookie(event: { node?: { req?: { headers?: { cookie?: string } } } }): string | null {
  const raw = getCookie(event as never, HOST_LOCALE_COOKIE)
  return raw?.trim() || null
}

export function writeLocaleCookie(event: object, locale: HostLocale): void {
  setCookie(event as never, HOST_LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    httpOnly: false,
  })
}

export async function resolveEventLocale(
  event: object,
  store?: OpenedStore,
): Promise<HostLocale> {
  if (isPreviewLocaleForced()) {
    return DEFAULT_HOST_LOCALE
  }
  const cookie = readLocaleCookie(event)
  const session = await readOwnerSession(event)
  let memberLocale: string | null = null
  if (session?.user?.role === 'member' && session.user.id) {
    const member = getMember(store ?? useStore(), session.user.id)
    memberLocale = member?.locale ?? null
  }
  return resolveHostLocale({ cookie, memberLocale })
}

export function parseLocaleBody(value: unknown): HostLocale {
  if (!isHostLocale(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Locale must be en or ru' })
  }
  return value
}
