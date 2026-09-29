import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import {
  buildAttachExpression,
  buildClickExpression,
  buildClipExpression,
  buildReadyExpression,
  buildScrollEndExpression,
  buildTypeExpression,
  chromeCandidates,
  DEFAULT_SHOOT_DIR,
  DEFAULT_VIEWPORT,
  ipv6Base,
  missingChromeMessage,
  missingHostMessage,
  NARROW_VIEWPORT,
  PREVIEW_SHOOT_STATES,
  previewSeedPath,
  previewShootOutputPath,
  previewShootStateNames,
  previewShootUsage,
  resolveChromePath,
  resolvePreviewShootState,
} from './preview-shoot.mjs'

const src = readFileSync(join(import.meta.dirname, 'preview-shoot.mjs'), 'utf8')
const agents = readFileSync(join(import.meta.dirname, '..', 'AGENTS.md'), 'utf8')

it('names the preview states agents are asked to shoot', () => {
  expect(previewShootStateNames()).toEqual([
    'chat',
    'system',
    'readme-chat',
    'providers-empty',
    'providers-fixture',
    'settings-other',
    'members',
    'narrow',
    'closet',
    'closet-end',
    'schedule-new',
    'schedule',
    'member-add',
    'plus-menu',
    'account-menu',
    'search',
    'bot-picker',
    'thread-composer',
    'kitchen',
    'kitchen-end',
    'composer',
    'composer-multiline',
    'composer-attachments',
    'composer-room',
  ])
})

it('shoots the Chat composer pill at rest, multiline, with attachments, and in a room', () => {
  expect(PREVIEW_SHOOT_STATES.composer.ready).toEqual({ selector: '.composer-row:not(.multiline) .attach', count: 1 })
  expect(PREVIEW_SHOOT_STATES['composer-multiline'].type.selector).toBe('.composer textarea')
  expect(PREVIEW_SHOOT_STATES['composer-multiline'].type.text.split('\n')).toHaveLength(3)
  expect(PREVIEW_SHOOT_STATES['composer-multiline'].ready.selector).toBe('.composer-row.multiline .send')
  expect(PREVIEW_SHOOT_STATES['composer-attachments'].attach).toBe('.composer input[type="file"]')
  expect(PREVIEW_SHOOT_STATES['composer-attachments'].ready).toEqual({ selector: '.pending-chip.ready', count: 2 })
  expect(PREVIEW_SHOOT_STATES['composer-room'].seed).toBe('rooms=1')
  for (const name of ['composer', 'composer-multiline', 'composer-attachments', 'composer-room']) {
    expect(PREVIEW_SHOOT_STATES[name].clip).toBe('.composer')
  }

  const type = buildTypeExpression('.composer textarea', 'a\nb')
  expect(type).toContain('isHydrating')
  expect(type).toContain('HTMLTextAreaElement.prototype')
  expect(type).toContain('new Event(\'input\', { bubbles: true })')
  const attach = buildAttachExpression('.composer input[type="file"]')
  expect(attach).toContain('isHydrating')
  expect(attach).toContain('new DataTransfer()')
  expect(attach).toContain('image/png')
  expect(attach).toContain('text/plain')
  expect(attach).toContain('new Event(\'change\', { bubbles: true })')
  expect(buildClipExpression('.composer')).toContain('getBoundingClientRect')
})

it('opens Sheets with a click chain after hydration', () => {
  expect(PREVIEW_SHOOT_STATES.closet.clicks).toEqual(['.identity'])
  expect(PREVIEW_SHOOT_STATES['closet-end'].scrollEnd).toBe('.kit-sheet--end')
  expect(PREVIEW_SHOOT_STATES['schedule-new'].clicks.at(-1)).toBe('#schedules-heading + .kit-button')
  expect(PREVIEW_SHOOT_STATES.schedule.clicks.at(-1)).toBe('.schedule-row')
  expect(PREVIEW_SHOOT_STATES.schedule.hint).toContain('Add one in the Closet first')
  expect(PREVIEW_SHOOT_STATES['member-add'].ready).toEqual({ selector: '.kit-sheet input[type="password"]', count: 2 })
  expect(PREVIEW_SHOOT_STATES['member-add'].clicks.at(-1)).toBe('.kit-menu .kit-menu-item:last-child')
  expect(PREVIEW_SHOOT_STATES['plus-menu'].ready).toEqual({ selector: '.kit-menu .kit-menu-item', count: 4 })
  expect(PREVIEW_SHOOT_STATES['account-menu'].clicks).toEqual(['.foot .user-btn'])
  expect(PREVIEW_SHOOT_STATES.search.clicks).toEqual(['.side-head .chrome:first-child'])
  expect(PREVIEW_SHOOT_STATES.search.ready).toEqual({ selector: '.kit-dialog .kit-row[data-selected]', count: 1 })
  expect(PREVIEW_SHOOT_STATES['bot-picker'].clicks.at(-1)).toBe('.kit-menu .kit-menu-item:first-child')
  expect(PREVIEW_SHOOT_STATES['bot-picker'].ready).toEqual({ selector: '.picker .kit-row', count: 2, any: ['.picker input[type="search"]:focus'] })
  expect(PREVIEW_SHOOT_STATES['thread-composer'].seed).toBe('threads=1')
  expect(PREVIEW_SHOOT_STATES['thread-composer'].clicks.at(-1)).toBe('.kit-menu .kit-menu-item:nth-child(3)')
  expect(PREVIEW_SHOOT_STATES['thread-composer'].ready).toEqual({ selector: '.composer .kit-row', count: 1, any: ['.composer input[type="search"]:focus'] })
  expect(PREVIEW_SHOOT_STATES.kitchen.seed).toBe('kitchen=1')
  expect(PREVIEW_SHOOT_STATES.kitchen.clicks).toEqual(['.kit-chat-parts .kit-button'])
  expect(PREVIEW_SHOOT_STATES.kitchen.ready).toEqual({ selector: '.kit-sheet .kitchen .xp', count: 1 })
  expect(PREVIEW_SHOOT_STATES['kitchen-end'].scrollEnd).toBe('.kit-sheet')
  const click = buildClickExpression('.identity')
  expect(click).toContain('isHydrating')
  expect(click).toContain('querySelector(".identity")')
  expect(buildScrollEndExpression('.kit-sheet--end')).toContain('scrollHeight')
})

it('shoots any state at 390px with --narrow', () => {
  const narrow = resolvePreviewShootState('closet', { narrow: true })
  expect(narrow?.name).toBe('closet-narrow')
  expect(narrow?.viewport).toEqual(NARROW_VIEWPORT)
  expect(resolvePreviewShootState('narrow', { narrow: true })?.name).toBe('narrow')
  expect(previewShootUsage()).toContain('--narrow')
})

it('reuses preview-seed flags and waits for an explicit ready marker', () => {
  expect(previewSeedPath(PREVIEW_SHOOT_STATES.chat)).toBe('/preview-seed')
  expect(PREVIEW_SHOOT_STATES.chat.ready).toEqual({ selector: '.bubble', count: 1 })
  expect(PREVIEW_SHOOT_STATES.chat.viewport).toEqual(DEFAULT_VIEWPORT)

  expect(previewSeedPath(PREVIEW_SHOOT_STATES.system)).toBe('/preview-seed?system=1')
  expect(PREVIEW_SHOOT_STATES.system.ready).toEqual({ selector: '.bubble.system', count: 3 })

  expect(previewSeedPath(PREVIEW_SHOOT_STATES['readme-chat'])).toBe('/preview-seed?readme=1')
  expect(PREVIEW_SHOOT_STATES['readme-chat'].ready).toEqual({
    selector: '.bubble',
    count: 7,
    none: ['.purpose', 'vite-error-overlay'],
  })

  expect(previewSeedPath(PREVIEW_SHOOT_STATES['providers-empty'])).toBe('/preview-seed?settings=1')
  expect(PREVIEW_SHOOT_STATES['providers-empty'].ready.selector).toBe('.providers .add')

  expect(previewSeedPath(PREVIEW_SHOOT_STATES['providers-fixture'])).toBe('/preview-seed?providers=1')
  expect(PREVIEW_SHOOT_STATES['providers-fixture'].ready.selector).toBe('.provider')
  expect(PREVIEW_SHOOT_STATES['providers-fixture'].ready.any).toEqual(['.shelf .card:not(.skeleton)'])
  expect(PREVIEW_SHOOT_STATES['providers-fixture'].ready.any).not.toContain('.shelf .banner')
  expect(PREVIEW_SHOOT_STATES['providers-fixture'].ready.none).toEqual([
    '.shelf [aria-busy="true"]',
    'vite-error-overlay',
  ])

  expect(PREVIEW_SHOOT_STATES['settings-other'].thenPath).toBe('/dashboard/cluster')
  expect(PREVIEW_SHOOT_STATES['settings-other'].ready.selector).toBe('.cluster input[name="timezone"]')

  expect(previewSeedPath(PREVIEW_SHOOT_STATES.members)).toBe('/preview-seed?members=1')
  expect(PREVIEW_SHOOT_STATES.members.ready.selector).toBe('.members h1')

  expect(PREVIEW_SHOOT_STATES.narrow.viewport).toEqual(NARROW_VIEWPORT)
  expect(PREVIEW_SHOOT_STATES.narrow.ready.selector).toBe('.providers h1')
})

it('resolves a state or lists usage for an unknown name', () => {
  expect(resolvePreviewShootState('system')?.name).toBe('system')
  expect(resolvePreviewShootState('nope')).toBeNull()
  const usage = previewShootUsage()
  expect(usage).toContain('pnpm shoot:preview <state>')
  expect(usage).toContain('pnpm preview:host')
  expect(usage).toContain('PREVIEW_SMOKE_URL')
  expect(usage).toContain('system')
  expect(usage).toContain('not network idle')
})

it('writes gitignored PNGs under .preview-shots by default', () => {
  expect(previewShootOutputPath('system')).toBe(`${DEFAULT_SHOOT_DIR}/system.png`)
  expect(previewShootOutputPath('narrow', '/tmp/shots')).toBe('/tmp/shots/narrow.png')
})

it('builds a DOM ready expression that counts nodes and ignores network idle', () => {
  const expression = buildReadyExpression({
    selector: '.bubble.system',
    count: 3,
    any: ['.shelf .card:not(.skeleton)'],
    none: ['.shelf [aria-busy="true"]'],
  })
  expect(expression).toContain('querySelectorAll(".bubble.system")')
  expect(expression).toContain('nodes.length < 3')
  expect(expression).toContain('querySelector(".shelf .card:not(.skeleton)")')
  expect(expression).toContain('querySelector(".shelf [aria-busy=\\"true\\"]")')
  expect(src).not.toContain('networkidle')
  expect(src).not.toContain('--virtual-time-budget')
})

it('tells the agent to start preview:host when the Host is down', () => {
  expect(missingHostMessage('http://localhost:3000', 'ECONNREFUSED')).toContain('pnpm preview:host')
  expect(missingHostMessage('http://localhost:3000', 'ECONNREFUSED')).toContain('not 127.0.0.1')
  expect(missingChromeMessage()).toContain('CHROME_PATH')
})

it('prefers CHROME_PATH and the chrome binaries already on a cloud agent VM', () => {
  const here = join(import.meta.dirname, 'preview-shoot.mjs')
  expect(chromeCandidates({ CHROME_PATH: '/opt/custom/chrome' })[0]).toBe('/opt/custom/chrome')
  expect(chromeCandidates({})).toContain('/usr/bin/google-chrome')
  expect(resolveChromePath(['/no/such/chrome', here])).toBe(here)
  expect(resolveChromePath(['/no/such/chrome'])).toBeNull()
})

it('rewrites localhost to IPv6 the same way the preview smoke does', () => {
  expect(ipv6Base('http://localhost:3000')).toBe('http://[::1]:3000')
  expect(ipv6Base('http://127.0.0.1:3000')).toBeNull()
})

it('documents shoot:preview next to preview-seed in AGENTS.md', () => {
  expect(agents).toContain('pnpm shoot:preview system')
  expect(agents).toContain('.preview-shots/')
  expect(agents).toContain('OPENROUTER_TEST_KEY')
  expect(agents).toContain('54rem')
  expect(agents).toContain('/dashboard/providers')
  expect(agents).toContain('/dashboard/members')
  expect(agents).toContain('`members`')
  expect(agents).toContain('.shelf .card:not(.skeleton)')
  expect(agents).not.toContain('cards or miss banner')
  expect(agents).toContain('`readme-chat`')
  expect(agents).toContain('`composer-attachments`')
  expect(agents).toContain('{\'@\'}')
})
