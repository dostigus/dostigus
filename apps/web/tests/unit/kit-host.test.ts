import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const webRoot = join(import.meta.dirname, '../..')

function read(rel: string): string {
  return readFileSync(join(webRoot, rel), 'utf8')
}

it('uses the Kit mark, sticker, Dialog, and Sheet on the Host', () => {
  const mark = read('app/components/HostMark.vue')
  const empty = read('app/components/HostBotEmpty.vue')
  const sidebar = read('app/components/HostSidebar.vue')
  const layout = read('app/layouts/host.vue')
  const create = read('app/components/BotCreateDialog.vue')
  const members = read('app/pages/members.vue')
  const settings = read('app/pages/settings.vue')
  const nuxt = read('nuxt.config.ts')

  expect(mark).toContain('GooseLogo')
  expect(mark).not.toContain('🪿')
  expect(empty).toContain('name="wave"')
  expect(empty).toContain('KitButton')
  expect(empty).toContain('Create a Bot')
  expect(sidebar).toContain('KitButton')
  expect(sidebar).toContain('to="/members"')
  expect(sidebar).toContain('to="/settings"')
  expect(layout).toContain('BotCreateDialog')
  expect(create).toContain('KitDialog')
  expect(create).toContain('name="ok"')
  expect(members).toContain('KitSheet')
  expect(members).toContain('Add a Member')
  expect(members).toContain('name="peek"')
  expect(members).toContain('layout: \'host\'')
  expect(settings).toContain('layout: \'host\'')
  expect(settings).not.toContain('KitSheet')
  expect(read('app/pages/index.vue')).toContain('layout: \'host\'')
  expect(read('app/pages/bots/[id].vue')).toContain('layout: \'host\'')
  expect(read('app/pages/bots/[id].vue')).toContain('withOptimisticUser')
  expect(read('app/pages/bots/[id].vue')).toContain('botPending')
  expect(nuxt).toContain('gooseFavicon')
  expect(nuxt).toContain('brandDir')
  expect(read('app/app.vue')).toContain('<NuxtLayout>')
})
