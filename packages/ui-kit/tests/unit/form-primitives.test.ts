import type { Component } from 'vue'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { uiKitComponents } from '../../src/components'
import KitButton from '../../src/components/KitButton.vue'
import KitChip from '../../src/components/KitChip.vue'
import KitField from '../../src/components/KitField.vue'
import KitInput from '../../src/components/KitInput.vue'
import KitListRow from '../../src/components/KitListRow.vue'
import KitPanel from '../../src/components/KitPanel.vue'
import KitSelect from '../../src/components/KitSelect.vue'
import KitTextarea from '../../src/components/KitTextarea.vue'
import KitToggle from '../../src/components/KitToggle.vue'
import * as kit from '../../src/index'

function render(component: Component, props: Record<string, unknown> = {}, slots?: Record<string, () => unknown>) {
  return renderToString(createSSRApp({ render: () => h(component, props, slots) }))
}

/** Vue SSR wraps slot and fragment content in `<!--[-->` and `<!--]-->` markers. */
const MARK = '(?:<!--[[\\]]-->)*'

function attr(html: string, selector: RegExp, name: string): string | undefined {
  const tag = html.match(selector)?.[0]
  return tag?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

it('labels the control above it and puts hint and error below', async () => {
  const html = await render(KitField, {
    label: 'IANA timezone',
    hint: 'Using UTC until you set a timezone.',
    error: 'Cluster timezone must be an IANA name.',
    required: true,
  }, {
    default: () => h(KitInput, { name: 'timezone', placeholder: 'America/New_York', modelValue: 'Mars/Olympus' }),
  })
  const inputId = attr(html, /<input[^>]*>/, 'id')
  expect(inputId).toBeTruthy()
  expect(attr(html, /<label[^>]*>/, 'for')).toBe(inputId)
  expect(attr(html, /<input[^>]*>/, 'name')).toBe('timezone')
  expect(attr(html, /<input[^>]*>/, 'value')).toBe('Mars/Olympus')
  expect(attr(html, /<input[^>]*>/, 'aria-invalid')).toBe('true')
  expect(html).toMatch(/<input[^>]*\srequired/)
  expect(attr(html, /<input[^>]*>/, 'aria-describedby')).toBe(`${inputId}-hint ${inputId}-error`)
  expect(html).toContain(`id="${inputId}-hint"`)
  expect(html).toContain(`id="${inputId}-error"`)
  expect(html.indexOf('<label')).toBeLessThan(html.indexOf('<input'))
  expect(html.indexOf('<input')).toBeLessThan(html.indexOf('kit-field-hint'))
  expect(html.indexOf('kit-field-hint')).toBeLessThan(html.indexOf('kit-field-error'))
  expect(html).toMatch(/class="kit-field-error"[^>]*role="alert"/)
})

it('leaves a clean field valid and undescribed', async () => {
  const html = await render(KitField, { label: 'Hostnames' }, {
    default: () => h(KitTextarea, { name: 'http-allowlist', rows: 4 }),
  })
  const id = attr(html, /<textarea[^>]*>/, 'id')
  expect(attr(html, /<label[^>]*>/, 'for')).toBe(id)
  expect(html).not.toContain('aria-invalid')
  expect(html).not.toContain('aria-describedby')
  expect(html).not.toContain('kit-field-error')
  expect(html).toContain('kit-input--multiline')
})

it('gives every field its own control id', async () => {
  const html = await renderToString(createSSRApp({
    render: () => [
      h(KitField, { label: 'A' }, { default: () => h(KitInput) }),
      h(KitField, { label: 'B' }, { default: () => h(KitInput) }),
    ],
  }))
  const ids = [...html.matchAll(/<input[^>]*\sid="([^"]+)"/g)].map((match) => match[1])
  expect(ids).toHaveLength(2)
  expect(new Set(ids).size).toBe(2)
})

it('builds the select on Reka and shows the chosen label', async () => {
  const html = await render(KitField, { label: 'Language' }, {
    default: () => h(KitSelect, {
      name: 'locale',
      modelValue: 'ru',
      options: [{ value: 'en', label: 'EN' }, { value: 'ru', label: 'RU' }],
    }),
  })
  const trigger = /<button[^>]*role="combobox"[^>]*>/
  expect(html).toMatch(trigger)
  expect(attr(html, trigger, 'id')).toBe(attr(html, /<label[^>]*>/, 'for'))
  expect(html).toContain('kit-select')
  expect(html).toMatch(new RegExp(`class="kit-select-value"[^>]*>${MARK}RU${MARK}<`))
  const empty = await render(KitSelect, { options: [{ value: 'en', label: 'EN' }], placeholder: 'Pick one' })
  expect(empty).toMatch(new RegExp(`kit-select-value kit-select-value--empty[^>]*>${MARK}Pick one${MARK}<`))
})

it('builds the toggle on Reka Switch with a clickable label', async () => {
  const on = await render(KitToggle, { label: 'Active', modelValue: true, class: 'switch-row' })
  const control = /<button[^>]*role="switch"[^>]*>/
  expect(on).toMatch(control)
  expect(attr(on, control, 'aria-checked')).toBe('true')
  expect(attr(on, /<label[^>]*>/, 'for')).toBe(attr(on, control, 'id'))
  expect(on).toMatch(/<div class="kit-toggle switch-row"/)
  const off = await render(KitToggle, { 'aria-label': 'Active', 'modelValue': false })
  expect(attr(off, control, 'aria-checked')).toBe('false')
  expect(attr(off, control, 'aria-label')).toBe('Active')
  expect(off).not.toContain('<label')
})

it('titles a panel, names its landmark, and keeps actions in a footer', async () => {
  const html = await render(KitPanel, { as: 'form', title: 'Cluster timezone', description: 'Schedules use this wall clock.' }, {
    default: () => h('p', 'body'),
    actions: () => h('button', 'Save'),
  })
  expect(html.startsWith('<form')).toBe(true)
  const titleId = attr(html, /<h2[^>]*>/, 'id')
  expect(attr(html, /<form[^>]*>/, 'aria-labelledby')).toBe(titleId)
  expect(html).toMatch(new RegExp(`<footer class="kit-panel-actions">${MARK}<button>Save</button>${MARK}</footer>`))
  const bare = await render(KitPanel, {}, { default: () => 'x' })
  expect(bare).not.toContain('aria-labelledby')
  expect(bare).not.toContain('<header')
})

it('reports chip state as pressed or leaves it to a radio group', async () => {
  const status = await render(KitChip, { tone: 'ok' }, { default: () => 'Saved' })
  expect(status).toMatch(new RegExp(`^<span class="kit-chip kit-chip--ok">${MARK}Saved${MARK}</span>$`))
  const toggle = await render(KitChip, { as: 'button', selected: true }, { default: () => 'Work' })
  expect(toggle).toContain('type="button"')
  expect(toggle).toContain('aria-pressed="true"')
  expect(toggle).toContain('data-selected')
  const radio = await render(KitChip, { 'as': 'button', 'selected': true, 'role': 'radio', 'aria-checked': 'true' }, { default: () => 'EN' })
  expect(radio).not.toContain('aria-pressed')
  expect(radio).toContain('aria-checked="true"')
})

it('lays out a list row with leading, copy, and trailing slots', async () => {
  const html = await render(KitListRow, { as: 'button', title: 'Kitchen', subtitle: 'Dinner at seven', selected: true }, {
    leading: () => h('span', { class: 'mark' }),
    trailing: () => '⌘1',
  })
  expect(html).toContain('type="button"')
  expect(html).toContain('kit-row--interactive')
  expect(html).toContain('data-selected')
  expect(html.indexOf('kit-row-leading')).toBeLessThan(html.indexOf('kit-row-title'))
  expect(html.indexOf('kit-row-subtitle')).toBeLessThan(html.indexOf('kit-row-trailing'))
  const still = await render(KitListRow, { title: 'Owner' })
  expect(still).not.toContain('kit-row--interactive')
  expect(still).not.toContain('kit-row-subtitle')
})

it('keeps a disabled pressable row dimmed without the hover tint', async () => {
  const html = await render(KitListRow, { as: 'button', title: 'Kitchen', disabled: true })
  expect(html).toMatch(/<button[^>]*\sdisabled/)
  const css = readFileSync(join(import.meta.dirname, '../../src/kit.css'), 'utf8')
  expect(css).toContain('.kit-row--interactive:hover:not(:disabled, [aria-disabled=\'true\'])')
  expect(css).not.toMatch(/\.kit-row--interactive:hover\s*\{/)
})

it('draws the pane close as a quiet muted button on Host tokens', async () => {
  const html = await render(KitButton, { 'variant': 'close', 'aria-label': 'Back' }, { default: () => '×' })
  expect(html).toMatch(/^<button type="button" class="kit-button kit-button--close" aria-label="Back">/)
  const css = readFileSync(join(import.meta.dirname, '../../src/kit.css'), 'utf8')
  const rule = css.slice(css.indexOf('.kit-button--close {'), css.indexOf('}', css.indexOf('.kit-button--close {')))
  expect(rule).toContain('background: transparent')
  expect(rule).toContain('color: var(--text-muted')
  expect(rule).toContain('border-radius: 999px')
})

it('lets a pane focus a Kit input on open', () => {
  const src = readFileSync(join(import.meta.dirname, '../../src/components/KitInput.vue'), 'utf8')
  expect(src).toContain('ref="el"')
  expect(src).toMatch(/defineExpose\(\{\s*focus: \(\) => el\.value\?\.focus\(\),\s*\}\)/)
})

it('exports every primitive from the Kit barrel', () => {
  for (const name of ['KitChip', 'KitField', 'KitInput', 'KitListRow', 'KitPanel', 'KitSelect', 'KitTextarea', 'KitToggle'] as const) {
    expect(kit[name]).toBeTruthy()
    expect(Object.values(uiKitComponents)).toContain(name)
  }
})
