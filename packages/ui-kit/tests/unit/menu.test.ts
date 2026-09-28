import type { Component } from 'vue'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { uiKitComponents } from '../../src/components'
import KitMenu from '../../src/components/KitMenu.vue'
import KitMenuItem from '../../src/components/KitMenuItem.vue'
import KitMenuSeparator from '../../src/components/KitMenuSeparator.vue'
import * as kit from '../../src/index'

const src = join(import.meta.dirname, '../../src')

function render(component: Component, props: Record<string, unknown> = {}, slots?: Record<string, unknown>) {
  return renderToString(createSSRApp({ render: () => h(component, props, slots) }))
}

function attr(html: string, selector: RegExp, name: string): string | undefined {
  const tag = html.match(selector)?.[0]
  return tag?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

it('puts Reka menu wiring on the Host trigger and portals the items', async () => {
  const html = await render(KitMenu, {}, {
    trigger: () => h('button', { 'class': 'chrome', 'aria-label': 'Create' }, '+'),
    default: () => [
      h(KitMenuItem, { hint: 'Bot list' }, () => 'Find or create a Bot'),
      h(KitMenuSeparator),
      h(KitMenuItem, { danger: true }, () => 'Delete'),
    ],
  })
  const trigger = /<button[^>]*class="chrome"[^>]*>/
  expect(html).toMatch(trigger)
  expect(html.match(/<button\b/g)).toHaveLength(1)
  expect(attr(html, trigger, 'aria-haspopup')).toBe('menu')
  expect(attr(html, trigger, 'aria-expanded')).toBe('false')
  expect(attr(html, trigger, 'data-state')).toBe('closed')
  expect(attr(html, trigger, 'aria-label')).toBe('Create')
  expect(attr(html, trigger, 'id')).toBeTruthy()
  expect(html).not.toContain('Find or create a Bot')
})

it('disables the trigger and reports open state', async () => {
  const off = await render(KitMenu, { disabled: true }, {
    trigger: () => h('button', { class: 'user-btn' }, 'Nick'),
  })
  expect(off).toMatch(/<button[^>]*\sdisabled/)
  expect(off).toContain('data-disabled')
  const open = await render(KitMenu, { open: true }, {
    trigger: () => h('button', { class: 'user-btn' }, 'Nick'),
  })
  expect(attr(open, /<button[^>]*>/, 'aria-expanded')).toBe('true')
  expect(attr(open, /<button[^>]*>/, 'data-state')).toBe('open')
})

it('styles the menu surface and items on Host tokens only', () => {
  const menu = readFileSync(join(src, 'components/KitMenu.vue'), 'utf8')
  const item = readFileSync(join(src, 'components/KitMenuItem.vue'), 'utf8')
  const css = readFileSync(join(src, 'kit.css'), 'utf8')
  expect(menu).toContain('DropdownMenuPortal')
  expect(menu).toContain('class="kit-popover kit-menu"')
  expect(menu).not.toContain('KitPanel')
  expect(item).toContain('DropdownMenuItem')
  expect(item).toContain('kit-menu-item--danger')
  expect(css).toMatch(/\.kit-menu-item:focus-visible \{\n {2}outline: 2px solid var\(--accent-dim, #d94a28\);/)
  expect(css).toMatch(/\.kit-menu-item\[data-highlighted\] \{\n {2}background: color-mix\(in srgb, var\(--text, #ffffff\) 6%, transparent\);/)
  expect(css).toMatch(/\.kit-menu-item\[data-disabled\] \{\n {2}opacity: 0\.55;\n {2}cursor: not-allowed;/)
  expect(css).toContain('max-width: min(20rem, calc(100vw - 1rem));')
  expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.kit-menu \{\n {4}animation: none;/)
  const menuRules = css.slice(css.indexOf('.kit-menu {'), css.indexOf('.kit-toggle {'))
  expect(menuRules).not.toMatch(/#[0-9a-f]{3,8}\b(?![^(]*\))/i)
})

it('exports the menu from the Kit barrel', () => {
  for (const name of ['KitMenu', 'KitMenuItem', 'KitMenuSeparator'] as const) {
    expect(kit[name]).toBeTruthy()
    expect(Object.values(uiKitComponents)).toContain(name)
  }
})
