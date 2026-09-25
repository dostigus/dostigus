import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tHost } from '@dostigus/ui-kit/locale'
import { expect, it } from 'vitest'

const appRoot = join(import.meta.dirname, '../../app')

function read(rel: string): string {
  return readFileSync(join(appRoot, rel), 'utf8')
}

it('gives Settings its own chrome without the Host Bot list', () => {
  const layout = read('layouts/settings.vue')
  const page = read('pages/settings.vue')
  const host = read('layouts/host.vue')

  expect(page).toContain('layout: \'settings\'')
  expect(page).toContain('$t(\'settings.title\')')
  expect(page).toContain('<NuxtPage />')
  expect(page).not.toContain('HostMenuButton')
  expect(page).not.toContain('class="top"')
  expect(page).not.toContain('overflow: auto')

  expect(layout).toContain('class="rail"')
  expect(layout).toContain('class="pane"')
  expect(layout).toContain('overflow: auto')
  expect(layout).toContain('to="/"')
  expect(layout).toContain('settings.nav.back')
  expect(layout).toContain('aria-current')
  expect(layout).not.toContain('HostSidebar')
  expect(layout).not.toContain('HostSearch')
  expect(layout).not.toContain('HostMenuButton')
  expect(layout).not.toContain('type="search"')
  expect(layout).not.toContain('host.nav.search')

  expect(host).toContain('HostSidebar')
  expect(host).not.toContain('settings.nav.back')

  expect(tHost('en', 'settings.nav.back')).toBe('Bots')
  expect(tHost('en', 'settings.nav.backAria')).toBe('Back to Bots')
  expect(tHost('ru', 'settings.nav.back')).toBe('Боты')
  expect(tHost('ru', 'settings.nav.backAria')).toBe('Назад к Боты')
})
