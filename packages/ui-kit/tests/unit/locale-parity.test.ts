import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { HOST_LOCALE_MESSAGES, localeMessageKeys } from '../../src/locale'

it('keeps the same key set in EN and RU dictionaries', () => {
  const en = localeMessageKeys(HOST_LOCALE_MESSAGES.en)
  const ru = localeMessageKeys(HOST_LOCALE_MESSAGES.ru)
  expect(ru).toEqual(en)
  expect(en.length).toBeGreaterThan(80)
})

it('keeps the Host i18n copies identical to the Kit dictionaries', () => {
  const kit = join(import.meta.dirname, '../../locales')
  const host = join(import.meta.dirname, '../../../../apps/web/i18n/locales')
  for (const file of ['en.json', 'ru.json']) {
    expect(readFileSync(join(host, file), 'utf8')).toBe(readFileSync(join(kit, file), 'utf8'))
  }
})

it('does not use the loanword Thread in RU chrome values', () => {
  const values = localeMessageKeys(HOST_LOCALE_MESSAGES.ru)
    .map((key) => {
      const parts = key.split('.')
      let current: unknown = HOST_LOCALE_MESSAGES.ru
      for (const part of parts) {
        current = (current as Record<string, unknown>)[part]
      }
      return String(current)
    })
  expect(values.join('\n')).not.toMatch(/Thread/)
  expect(HOST_LOCALE_MESSAGES.ru.host.home.open).toBe('Открыть чат')
  expect(HOST_LOCALE_MESSAGES.en.host.home.open).toBe('Open chat')
})
