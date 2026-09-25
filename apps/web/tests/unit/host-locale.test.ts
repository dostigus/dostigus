import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createOwner, getMember, openStore, seedMemberLocale } from '@dostigus/db'
import { HOST_LOCALE_COOKIE, resolveHostLocale } from '@dostigus/ui-kit/locale'
import { afterEach, expect, it } from 'vitest'
import { addHouseholdMember } from '../../server/utils/household'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  createOwner(store, { email: 'owner@example.test', passwordHash: 'hash:owner' })
  return store
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('resolves cookie before Member.locale before default en', () => {
  expect(resolveHostLocale({ cookie: 'ru', memberLocale: 'en' })).toBe('ru')
  expect(resolveHostLocale({ cookie: null, memberLocale: 'ru' })).toBe('ru')
  expect(resolveHostLocale({})).toBe('en')
  expect(resolveHostLocale({ cookie: 'ru', memberLocale: 'ru', preview: true })).toBe('en')
  expect(HOST_LOCALE_COOKIE).toBe('dostigus_locale')
})

it('seeds Member.locale from the cookie on first login only', async () => {
  const store = memoryStore()
  const member = await addHouseholdMember(store, {
    displayName: 'Ada',
    login: 'ada',
    password: 'secret-pass',
  }, async (password) => `hash:${password}`)
  expect(member.locale).toBeNull()
  expect(seedMemberLocale(store, member.id, 'ru').locale).toBe('ru')
  expect(getMember(store, member.id)?.locale).toBe('ru')
  expect(seedMemberLocale(store, member.id, 'en').locale).toBe('ru')
})

it('wires Owner Settings Locale and preview seed to the cookie', () => {
  const root = join(import.meta.dirname, '../..')
  const login = readFileSync(join(root, 'server/api/auth/login.post.ts'), 'utf8')
  const other = readFileSync(join(root, 'app/pages/dashboard/cluster.vue'), 'utf8')
  const composable = readFileSync(join(root, 'app/composables/useHostLocale.ts'), 'utf8')
  const preview = readFileSync(join(root, 'server/routes/preview-seed.get.ts'), 'utf8')
  const nuxt = readFileSync(join(root, 'nuxt.config.ts'), 'utf8')
  expect(login).toContain('seedMemberLocale')
  expect(login).toContain('readLocaleCookie')
  expect(other).toContain('settings.other.locale.title')
  expect(composable).toContain('/api/settings/locale')
  expect(preview).toContain('writeLocaleCookie(event, \'en\')')
  expect(nuxt).toContain('strategy: \'no_prefix\'')
  expect(nuxt).toContain('@nuxtjs/i18n')
  expect(nuxt).toContain('previewSeed')
})
