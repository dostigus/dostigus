import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const webRoot = join(import.meta.dirname, '../..')

function read(rel: string): string {
  return readFileSync(join(webRoot, rel), 'utf8')
}

it('uses the Kit mark, sticker, Dialog, and Sheet on the Host', () => {
  const mark = read('app/components/HostMark.vue')
  const bots = read('app/pages/index.vue')
  const create = read('app/components/BotCreateDialog.vue')
  const members = read('app/pages/members.vue')
  const nuxt = read('nuxt.config.ts')

  expect(mark).toContain('GooseLogo')
  expect(mark).not.toContain('🪿')
  expect(bots).toContain('name="wave"')
  expect(bots).toContain('KitButton')
  expect(create).toContain('KitDialog')
  expect(create).toContain('name="ok"')
  expect(members).toContain('KitSheet')
  expect(members).toContain('Add a Member')
  expect(members).toContain('name="peek"')
  expect(nuxt).toContain('gooseFavicon')
  expect(nuxt).toContain('brandDir')
})
