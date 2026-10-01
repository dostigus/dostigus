import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import {
  buildAttachExpression,
  buildClickExpression,
  buildClipExpression,
  buildFillExpression,
  buildInviteExpression,
  buildReadyExpression,
  buildRevealExpression,
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
  SESSION_COOKIE,
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
    'members-admin',
    'narrow',
    'providers-health',
    'providers-shelf',
    'providers-edit',
    'providers-confirm',
    'providers-details',
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
    'composer-room-mention',
    'thread-roster',
    'thread-roster-add',
    'thread-case',
    'thread-case-edit',
    'onboarding',
    'onboarding-error',
    'home-empty',
    'login',
    'login-error',
    'invite',
    'invite-invalid',
  ])
})

it('shoots the signed-out login, onboarding, and Invite pages', () => {
  for (const name of ['onboarding', 'onboarding-error', 'home-empty', 'invite-invalid'] as const) {
    expect(previewSeedPath(PREVIEW_SHOOT_STATES[name])).toBeNull()
  }
  for (const name of ['onboarding', 'onboarding-error', 'home-empty'] as const) {
    expect(PREVIEW_SHOOT_STATES[name].thenPath).toBe('/onboarding')
    expect(PREVIEW_SHOOT_STATES[name].hint).toContain('fresh DATABASE_URL')
  }
  expect(PREVIEW_SHOOT_STATES['home-empty'].fill.map((field) => field.text)).toEqual(['preview', 'preview-owner', 'preview-owner'])
  expect(PREVIEW_SHOOT_STATES['home-empty'].ready.selector).toBe('.empty .kit-button')
  expect(PREVIEW_SHOOT_STATES['onboarding-error'].ready.any).toEqual(['[role="alert"]'])

  for (const name of ['login', 'login-error'] as const) {
    expect(previewSeedPath(PREVIEW_SHOOT_STATES[name])).toBe('/preview-seed')
    expect(PREVIEW_SHOOT_STATES[name].signOut).toBe(true)
    expect(PREVIEW_SHOOT_STATES[name].thenPath).toBe('/login')
  }
  expect(PREVIEW_SHOOT_STATES['login-error'].clicks).toEqual(['form [type="submit"]'])
  expect(PREVIEW_SHOOT_STATES.invite.invite).toBe(true)
  expect(PREVIEW_SHOOT_STATES.invite.ready.selector).toBe('input[type="email"][readonly]')
  expect(PREVIEW_SHOOT_STATES['invite-invalid'].ready.selector).toBe('a[href="/login"]')

  expect(src).toContain('Network.deleteCookies')
  expect(SESSION_COOKIE).toBe('nuxt-session')
  const fill = buildFillExpression([{ selector: 'input', index: 1, text: 'x' }])
  expect(fill).toContain('isHydrating')
  expect(fill).toContain('HTMLInputElement.prototype')
  expect(fill).toContain('new Event(\'input\', { bubbles: true })')
  const invite = buildInviteExpression('a@example.com')
  expect(invite).toContain('/api/members/invites')
  expect(invite).toContain('new URL(issued.url).pathname')
})

it('shoots the Chat composer pill at rest, multiline, with attachments, and in a room', () => {
  expect(PREVIEW_SHOOT_STATES.composer.ready).toEqual({ selector: '.composer-row:not(.multiline) .attach', count: 1 })
  expect(PREVIEW_SHOOT_STATES['composer-multiline'].type.selector).toBe('.composer textarea')
  expect(PREVIEW_SHOOT_STATES['composer-multiline'].type.text.split('\n')).toHaveLength(3)
  expect(PREVIEW_SHOOT_STATES['composer-multiline'].ready.selector).toBe('.composer-row.multiline .send')
  expect(PREVIEW_SHOOT_STATES['composer-attachments'].attach).toBe('.composer input[type="file"]')
  expect(PREVIEW_SHOOT_STATES['composer-attachments'].ready).toEqual({ selector: '.pending-chip.ready', count: 2 })
  expect(PREVIEW_SHOOT_STATES['composer-room'].seed).toBe('rooms=1')
  expect(PREVIEW_SHOOT_STATES['composer-room'].ready).toEqual({ selector: '.composer-row.has-lead .attach', count: 1 })
  expect(PREVIEW_SHOOT_STATES['composer-room-mention'].seed).toBe('rooms=1')
  expect(PREVIEW_SHOOT_STATES['composer-room-mention'].type).toEqual({ selector: '.composer textarea', text: '@' })
  for (const name of ['composer', 'composer-multiline', 'composer-attachments', 'composer-room', 'composer-room-mention']) {
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

it('runs fill before clicks in the shoot runner', () => {
  const fillAt = src.indexOf('if (state.fill)')
  const clicksAt = src.indexOf('for (const selector of state.clicks')
  const typeAt = src.indexOf('if (state.type)')
  expect(fillAt).toBeGreaterThan(-1)
  expect(clicksAt).toBeGreaterThan(fillAt)
  expect(typeAt).toBeGreaterThan(clicksAt)
  expect(agents).toContain('then `clicks`')
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

it('shoots Providers secondary chrome on the fixture shelf', () => {
  const secondary = ['providers-health', 'providers-shelf', 'providers-edit', 'providers-confirm', 'providers-details'] as const
  for (const name of secondary) {
    const state = PREVIEW_SHOOT_STATES[name]
    expect(previewSeedPath(state)).toBe('/preview-seed?providers=1')
    expect(state.ready.any).toEqual(PREVIEW_SHOOT_STATES['providers-fixture'].ready.any)
    expect(state.ready.none).toContain('vite-error-overlay')
    expect(state.clip).toBeTruthy()
  }
  expect(PREVIEW_SHOOT_STATES['providers-health'].clip).toBe('.providers .health')
  expect(PREVIEW_SHOOT_STATES['providers-shelf'].reveal).toBe('.provider .shelf')
  expect(PREVIEW_SHOOT_STATES['providers-edit'].clicks).toEqual(['.provider .p-actions .kit-button:first-child'])
  expect(PREVIEW_SHOOT_STATES['providers-edit'].ready.selector).toBe('.provider .edit')
  expect(PREVIEW_SHOOT_STATES['providers-confirm'].clicks).toEqual(['.provider .p-actions .kit-button:last-child'])
  expect(PREVIEW_SHOOT_STATES['providers-confirm'].ready.selector).toBe('.provider .confirm')
  expect(PREVIEW_SHOOT_STATES['providers-details'].ready.selector).toBe('.provider .more .advanced')
  expect(buildRevealExpression('.provider .more')).toContain('scrollIntoView')
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
  expect(previewSeedPath(PREVIEW_SHOOT_STATES['members-admin'])).toBe('/preview-seed?members=1&as=admin')

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
  expect(agents).toContain('pnpm preview:wait')
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
  expect(agents).toContain('symlink')
  expect(agents).toContain('There is no ordered')
  expect(agents).toContain('`?case=1`')
})
