import { expect, it } from 'vitest'
import { HOST_LOCALE_MESSAGES, localeMessageKeys } from '../../src/locale'

it('keeps the same key set in EN and RU dictionaries', () => {
  const en = localeMessageKeys(HOST_LOCALE_MESSAGES.en)
  const ru = localeMessageKeys(HOST_LOCALE_MESSAGES.ru)
  expect(ru).toEqual(en)
  expect(en.length).toBeGreaterThan(80)
})
