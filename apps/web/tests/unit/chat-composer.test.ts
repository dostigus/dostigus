import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const chat = readFileSync(join(import.meta.dirname, '../../app/pages/bots/[id].vue'), 'utf8')

function block(start: string, end: string): string {
  const from = chat.indexOf(start)
  const to = chat.indexOf(end, from + start.length)
  expect(from).toBeGreaterThan(-1)
  expect(to).toBeGreaterThan(from)
  return chat.slice(from, to)
}

it('overlays a slim composer on one scrolling Chat pane', () => {
  const composer = block('.composer {', '.composer-row,')
  const row = block('.composer-row {', '.composer-row.multiline')
  const thread = block('.thread {', '.bubble {')

  expect(composer).toContain('position: absolute')
  expect(composer).toContain('pointer-events: none')
  expect(composer).toContain('env(safe-area-inset-bottom')
  expect(composer).toContain('var(--bg-chat) calc(var(--composer-gap) + 2px)')
  expect(composer).toContain('--composer-gap')
  expect(composer).not.toContain('background: transparent')
  expect(composer).not.toContain('background: var(--composer)')
  const foot = block('.composer-foot {', '.composer-foot::before')
  const band = block('.composer-foot::before {', '.composer-row,')
  expect(foot).not.toContain('background:')
  expect(band).toContain('top: 50%')
  expect(band).toContain('bottom: -2px')
  expect(band).toContain('background: var(--bg-chat)')
  expect(band).not.toContain('border-radius')
  expect(row).toContain('background: var(--composer)')
  expect(row).toContain('padding: 0.3rem 0.4rem')
  expect(row).not.toContain('safe-area')
  expect(thread).toContain('var(--composer-clearance)')
  expect(thread).toContain('var(--thread-end-gap)')
  expect(thread).toContain('overflow: auto')
  expect(thread).toContain('overflow-anchor: none')
  expect(chat).toContain('--thread-end-gap: 5rem')
  expect(chat).toContain('el.scrollTop = el.scrollHeight')
  expect(chat).toContain('flush: \'post\', immediate: true')

  const formEnd = chat.indexOf('</form>')
  const jump = chat.indexOf('class="to-latest"')
  expect(formEnd).toBeGreaterThan(-1)
  expect(jump).toBeGreaterThan(formEnd)
  expect(chat).toContain('aria-label="Scroll to latest"')
  expect(chat).toContain('behavior: reduce ? \'auto\' : \'smooth\'')

  const control = block('.to-latest {', '.to-latest svg')
  expect(control).toContain('left: 50%')
  expect(control).toContain('translateX(-50%)')
  expect(control).toContain('var(--composer-clearance)')
  expect(control).toContain('border-radius: 999px')
  expect(control).toContain('background: var(--composer)')
})
