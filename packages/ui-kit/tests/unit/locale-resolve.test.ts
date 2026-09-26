import { expect, it } from 'vitest'
import {
  DEFAULT_HOST_LOCALE,
  HOST_LOCALE_COOKIE,
  isHostLocale,
  localizeGatewayErrorReply,
  resolveHostLocale,
  tHost,
} from '../../src/locale'

it('resolves cookie, then Member.locale, then default en', () => {
  expect(resolveHostLocale({})).toBe('en')
  expect(resolveHostLocale({ cookie: 'ru' })).toBe('ru')
  expect(resolveHostLocale({ cookie: 'de', memberLocale: 'ru' })).toBe('ru')
  expect(resolveHostLocale({ cookie: null, memberLocale: 'ru' })).toBe('ru')
  expect(resolveHostLocale({ cookie: 'ru', memberLocale: 'en' })).toBe('ru')
  expect(resolveHostLocale({ memberLocale: 'nope' })).toBe(DEFAULT_HOST_LOCALE)
  expect(isHostLocale('en')).toBe(true)
  expect(isHostLocale('ru')).toBe(true)
  expect(isHostLocale('de')).toBe(false)
  expect(HOST_LOCALE_COOKIE).toBe('dostigus_locale')
})

it('forces en in preview even when a cookie or Member.locale is set', () => {
  expect(resolveHostLocale({
    cookie: 'ru',
    memberLocale: 'ru',
    preview: true,
  })).toBe('en')
})

it('falls back to EN and never returns a raw key path', () => {
  expect(tHost('ru', 'kit.close')).toBe('Закрыть')
  expect(tHost('en', 'kit.close')).toBe('Close')
  expect(tHost('ru', 'no.such.key')).toBe('')
  expect(tHost('en', 'chat.placeholderFor', { name: 'Notes' })).toBe('Message for Notes')
})

it('remaps a stored gateway error bubble onto the current Locale', () => {
  const english = tHost('en', 'chat.errorGateway.owner.transient')
  const russian = tHost('ru', 'chat.errorGateway.owner.transient')
  expect(english).toContain('Could not reach the model')
  expect(localizeGatewayErrorReply(english, 'ru')).toBe(russian)
  expect(localizeGatewayErrorReply(russian, 'en')).toBe(english)
  expect(localizeGatewayErrorReply('A normal Chat line', 'ru')).toBe('A normal Chat line')
})
