import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tHost } from '@dostigus/ui-kit/locale'
import { expect, it } from 'vitest'

const appRoot = join(import.meta.dirname, '../../app')

function read(rel: string): string {
  return readFileSync(join(appRoot, rel), 'utf8')
}

it('gives Dashboard its own chrome without the Host Bot list', () => {
  const layout = read('layouts/dashboard.vue')
  const page = read('pages/dashboard.vue')
  const host = read('layouts/host.vue')

  expect(page).toContain('layout: \'dashboard\'')
  expect(page).toContain('$t(\'dashboard.title\')')
  expect(page).toContain('<NuxtPage />')
  expect(page).not.toContain('HostMenuButton')
  expect(page).not.toContain('class="top"')
  expect(page).not.toContain('overflow: auto')

  expect(layout).toContain('class="rail"')
  expect(layout).toContain('class="pane"')
  expect(layout).toContain('class="foot"')
  expect(layout).toContain('hide-settings')
  expect(layout).toContain('hide-members')
  expect(layout).toContain('overflow: auto')
  expect(layout).toContain('to="/"')
  expect(layout).toContain('to="/dashboard"')
  expect(layout).toContain('to="/dashboard/cluster"')
  expect(layout).toContain('to="/dashboard/providers"')
  expect(layout).toContain('to="/dashboard/settings"')
  expect(layout).toContain('to="/dashboard/members"')
  expect(layout).toContain('dashboard.nav.members')
  expect(layout).toContain('dashboard.nav.back')
  expect(layout).toContain('aria-current')
  expect(layout).not.toContain('HostSidebar')
  expect(layout).not.toContain('HostSearch')
  expect(layout).not.toContain('HostMenuButton')
  expect(layout).not.toContain('type="search"')
  expect(layout).not.toContain('host.nav.search')

  expect(host).toContain('HostSidebar')
  expect(host).not.toContain('dashboard.nav.back')

  expect(tHost('en', 'dashboard.nav.back')).toBe('Bots')
  expect(tHost('en', 'dashboard.nav.backAria')).toBe('Back to Bots')
  expect(tHost('ru', 'dashboard.nav.back')).toBe('Боты')
  expect(tHost('ru', 'dashboard.nav.backAria')).toBe('Назад к Боты')
  expect(tHost('ru', 'dashboard.nav.overview')).toBe('Главная')
  expect(tHost('ru', 'dashboard.nav.clusterSettings')).toBe('Настройки кластера')
  expect(tHost('ru', 'dashboard.nav.settings')).toBe('Настройки')
  expect(tHost('en', 'dashboard.nav.members')).toBe('Members')
  expect(tHost('en', 'dashboard.nav.membersHint')).toBe('Household on this Host')
  expect(tHost('ru', 'dashboard.nav.members')).toBe('Members')
  expect(tHost('ru', 'dashboard.nav.membersHint')).toBe('Household на этом Host')
})

it('reuses HostUserMenu and omits Settings on the Dashboard rail', () => {
  const menu = read('components/HostUserMenu.vue')
  const sidebar = read('components/HostSidebar.vue')
  const layout = read('layouts/dashboard.vue')

  expect(menu).toContain('hideSettings')
  expect(menu).toContain('hideMembers')
  expect(menu).toContain('isOwner && !hideSettings')
  expect(menu).toContain('isOwner && !hideMembers')
  expect(menu).toContain('to="/dashboard/settings"')
  expect(menu).toContain('to="/dashboard/members"')
  expect(menu).not.toContain('to="/members"')
  expect(menu).toContain('HostLogoutButton')
  expect(menu).toContain(':class="{ collapsed }"')
  expect(menu).toContain('.user.collapsed .user-btn')
  expect(menu).toContain('.user.collapsed .menu')
  expect(menu).not.toMatch(/:class="\{ rail:/)
  expect(menu).not.toMatch(/\.rail \.(?:user-btn|menu)/)
  expect(sidebar).toContain('<HostUserMenu :collapsed="rail" />')
  expect(sidebar).not.toContain('hide-settings')
  expect(layout).toContain('hide-settings')
  expect(layout).toContain('hide-members')
  expect(layout).not.toContain('collapsed')
  expect(layout.indexOf('class="items"')).toBeLessThan(layout.indexOf('class="foot"'))
})

it('does not keep /settings pages or redirects', () => {
  expect(existsSync(join(appRoot, 'pages/settings'))).toBe(false)
  expect(existsSync(join(appRoot, 'pages/members.vue'))).toBe(false)
  expect(read('layouts/dashboard.vue')).not.toContain('redirect:')
  expect(read('pages/dashboard.vue')).not.toContain('redirect:')
  const nuxt = readFileSync(join(appRoot, '../nuxt.config.ts'), 'utf8')
  expect(nuxt).not.toContain('routeRules')
  expect(nuxt).not.toMatch(/['"]\/settings/)
})
