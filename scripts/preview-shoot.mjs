/**
 * Screenshot one named Host preview state (`pnpm preview:host`).
 *
 * Uses CDP against Chrome/Chromium already on the VM. Waits for an
 * explicit ready marker, not network idle. Host Activity polling makes
 * idle-only captures unreliable.
 *
 *   pnpm preview:host
 *   pnpm shoot:preview system
 *
 * PREVIEW_SMOKE_URL (default http://localhost:3000).
 * PREVIEW_SHOOT_DIR (default .preview-shots).
 * PREVIEW_SHOOT_WAIT_MS (default 60000) for Host health + ready marker.
 * CHROME_PATH when google-chrome / chromium is not on PATH.
 */
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const DEFAULT_VIEWPORT = { width: 1440, height: 900 }
export const NARROW_VIEWPORT = { width: 390, height: 844 }
export const DEFAULT_SHOOT_DIR = '.preview-shots'

const COMPOSER_MULTILINE_TEXT = 'Dinner for four tonight\nNo mushrooms, one of us is vegetarian\nUnder forty minutes'

/** Pixels of page kept around a `clip` selector. Clips shoot at 2x. */
const CLIP_PAD_PX = 12

/** Providers states wait for the fixture shelf, as `providers-fixture` does. */
const PROVIDERS_SHELF_READY = {
  selector: '.provider',
  count: 1,
  any: ['.shelf .card:not(.skeleton)'],
  none: ['.shelf [aria-busy="true"]', 'vite-error-overlay'],
}

const PROVIDERS_SHELF_HINT = 'Providers secondary states seed the fixture OpenRouter Provider (?providers=1) and wait for shelf cards. Outbound HTTPS to openrouter.ai is required.'

/** nuxt-auth-utils session cookie. Deleting it leaves the Locale cookie. */
export const SESSION_COOKIE = 'nuxt-session'

const EMPTY_STORE_HINT = 'needs a Store with no Owner: restart pnpm preview:host on a fresh DATABASE_URL (for example file:.data/auth.sqlite) and shoot it before any /preview-seed state.'

const ONBOARDING_READY = { selector: 'input[autocomplete="new-password"]', count: 2 }

/** One invocation, one PNG. Seeds reuse preview-seed query flags. */
export const PREVIEW_SHOOT_STATES = {
  'chat': {
    seed: '',
    ready: { selector: '.bubble', count: 1 },
    viewport: DEFAULT_VIEWPORT,
  },
  'system': {
    seed: 'system=1',
    ready: { selector: '.bubble.system', count: 3 },
    viewport: DEFAULT_VIEWPORT,
  },
  'readme-chat': {
    seed: 'readme=1',
    ready: {
      selector: '.bubble',
      count: 7,
      none: ['.purpose', 'vite-error-overlay'],
    },
    viewport: DEFAULT_VIEWPORT,
    hint: 'readme-chat waits for the Kitchen dinner thread (greeting + 6 fixture lines) and no Vite i18n overlay.',
  },
  'providers-empty': {
    seed: 'settings=1',
    thenPath: '/dashboard/providers',
    ready: { selector: '.providers .add', count: 1 },
    viewport: DEFAULT_VIEWPORT,
    hint: 'providers-empty needs a Store with no Provider (use a fresh DATABASE_URL or remove the fixture on the page).',
  },
  'providers-fixture': {
    seed: 'providers=1',
    ready: PROVIDERS_SHELF_READY,
    viewport: DEFAULT_VIEWPORT,
    hint: 'providers-fixture waits for shelf cards (.shelf .card:not(.skeleton)), not the first-paint miss banner, and no Vite i18n overlay.',
  },
  'settings-other': {
    seed: 'settings=1',
    thenPath: '/dashboard/cluster',
    ready: { selector: '.cluster input[name="timezone"]', count: 1 },
    viewport: DEFAULT_VIEWPORT,
  },
  'members': {
    seed: 'members=1',
    ready: { selector: '.members h1', count: 1 },
    viewport: DEFAULT_VIEWPORT,
  },
  'narrow': {
    seed: 'settings=1',
    thenPath: '/dashboard/providers',
    ready: { selector: '.providers h1', count: 1 },
    viewport: NARROW_VIEWPORT,
  },
  'providers-health': {
    seed: 'providers=1',
    ready: PROVIDERS_SHELF_READY,
    clip: '.providers .health',
    viewport: DEFAULT_VIEWPORT,
    hint: PROVIDERS_SHELF_HINT,
  },
  'providers-shelf': {
    seed: 'providers=1',
    ready: PROVIDERS_SHELF_READY,
    reveal: '.provider .shelf',
    clip: '.provider .shelf',
    viewport: DEFAULT_VIEWPORT,
    hint: PROVIDERS_SHELF_HINT,
  },
  'providers-edit': {
    seed: 'providers=1',
    clicks: ['.provider .p-actions .kit-button:first-child'],
    ready: { ...PROVIDERS_SHELF_READY, selector: '.provider .edit' },
    clip: '.provider',
    viewport: DEFAULT_VIEWPORT,
    hint: PROVIDERS_SHELF_HINT,
  },
  'providers-confirm': {
    seed: 'providers=1',
    clicks: ['.provider .p-actions .kit-button:last-child'],
    ready: { ...PROVIDERS_SHELF_READY, selector: '.provider .confirm' },
    clip: '.provider',
    viewport: DEFAULT_VIEWPORT,
    hint: PROVIDERS_SHELF_HINT,
  },
  'providers-details': {
    seed: 'providers=1',
    clicks: ['.provider .more > :first-child'],
    ready: { ...PROVIDERS_SHELF_READY, selector: '.provider .more .advanced' },
    reveal: '.provider .more',
    clip: '.provider',
    viewport: DEFAULT_VIEWPORT,
    hint: PROVIDERS_SHELF_HINT,
  },
  'closet': {
    seed: '',
    clicks: ['.identity'],
    ready: { selector: '.kit-sheet--end .mark', count: 1 },
    viewport: DEFAULT_VIEWPORT,
  },
  'closet-end': {
    seed: '',
    clicks: ['.identity'],
    ready: { selector: '.kit-sheet--end .mark', count: 1 },
    scrollEnd: '.kit-sheet--end',
    viewport: DEFAULT_VIEWPORT,
  },
  'schedule-new': {
    seed: '',
    clicks: ['.identity', '#schedules-heading + .kit-button'],
    ready: { selector: '.kit-sheet--end .schedule form', count: 1 },
    viewport: DEFAULT_VIEWPORT,
  },
  'schedule': {
    seed: '',
    clicks: ['.identity', '.schedule-row'],
    ready: { selector: '.kit-sheet--end .schedule .history', count: 1 },
    viewport: DEFAULT_VIEWPORT,
    hint: 'schedule opens the first Schedule on Bot preview. Add one in the Closet first (Schedules, +).',
  },
  'member-add': {
    seed: '',
    clicks: ['.side-head .chrome[aria-haspopup="menu"]', '.kit-menu .kit-menu-item:last-child'],
    ready: { selector: '.kit-sheet input[type="password"]', count: 2 },
    viewport: DEFAULT_VIEWPORT,
  },
  'plus-menu': {
    seed: '',
    clicks: ['.side-head .chrome[aria-haspopup="menu"]'],
    ready: { selector: '.kit-menu .kit-menu-item', count: 4 },
    viewport: DEFAULT_VIEWPORT,
  },
  'account-menu': {
    seed: '',
    clicks: ['.foot .user-btn'],
    ready: { selector: '.kit-menu .kit-menu-item', count: 3 },
    viewport: DEFAULT_VIEWPORT,
  },
  'search': {
    seed: '',
    clicks: ['.side-head .chrome:first-child'],
    ready: { selector: '.kit-dialog .kit-row[data-selected]', count: 1 },
    viewport: DEFAULT_VIEWPORT,
  },
  'bot-picker': {
    seed: '',
    clicks: ['.side-head .chrome[aria-haspopup="menu"]', '.kit-menu .kit-menu-item:first-child'],
    ready: { selector: '.picker .kit-row', count: 2, any: ['.picker input[type="search"]:focus'] },
    viewport: DEFAULT_VIEWPORT,
  },
  'thread-composer': {
    seed: 'threads=1',
    clicks: ['.side-head .chrome[aria-haspopup="menu"]', '.kit-menu .kit-menu-item:nth-child(3)'],
    ready: { selector: '.composer .kit-row', count: 1, any: ['.composer input[type="search"]:focus'] },
    viewport: DEFAULT_VIEWPORT,
    hint: 'thread-composer seeds the preview Member (?threads=1) so the group composer lists a person row. Both pane states wait for the search field to hold focus after the + menu closes.',
  },
  'kitchen': {
    seed: 'kitchen=1',
    clicks: ['.kit-chat-parts .kit-button'],
    ready: { selector: '.kit-sheet .kitchen .xp', count: 1 },
    viewport: DEFAULT_VIEWPORT,
    hint: 'kitchen clicks the first Chat button on Bot preview. A prior ?parts=1 on the same Store puts Open demo first; use a fresh DATABASE_URL.',
  },
  'kitchen-end': {
    seed: 'kitchen=1',
    clicks: ['.kit-chat-parts .kit-button'],
    ready: { selector: '.kit-sheet .kitchen .xp', count: 1 },
    scrollEnd: '.kit-sheet',
    viewport: DEFAULT_VIEWPORT,
    hint: 'kitchen-end clicks the first Chat button on Bot preview. A prior ?parts=1 on the same Store puts Open demo first; use a fresh DATABASE_URL.',
  },
  'composer': {
    seed: '',
    ready: { selector: '.composer-row:not(.multiline) .attach', count: 1 },
    clip: '.composer',
    viewport: DEFAULT_VIEWPORT,
  },
  'composer-multiline': {
    seed: '',
    type: { selector: '.composer textarea', text: COMPOSER_MULTILINE_TEXT },
    ready: { selector: '.composer-row.multiline .send', count: 1 },
    clip: '.composer',
    viewport: DEFAULT_VIEWPORT,
  },
  'composer-attachments': {
    seed: '',
    attach: '.composer input[type="file"]',
    ready: { selector: '.pending-chip.ready', count: 2 },
    clip: '.composer',
    viewport: DEFAULT_VIEWPORT,
    hint: 'composer-attachments uploads a fixture PNG and a text file through POST /api/artifacts; both chips must reach ready.',
  },
  'composer-room': {
    seed: 'rooms=1',
    ready: { selector: '.composer-row.has-lead .attach', count: 1 },
    clip: '.composer',
    viewport: DEFAULT_VIEWPORT,
  },
  'composer-room-mention': {
    seed: 'rooms=1',
    type: { selector: '.composer textarea', text: '@' },
    ready: { selector: '.mention-picker [role="option"][data-selected]', count: 1 },
    clip: '.composer',
    viewport: DEFAULT_VIEWPORT,
    hint: 'composer-room-mention types @ in the Preview room composer; the picker lists the room Bot participants.',
  },
  'thread-roster': {
    seed: 'rooms=1',
    clicks: ['.identity'],
    ready: { selector: '.kit-sheet--end .add-row', count: 1 },
    viewport: DEFAULT_VIEWPORT,
    hint: 'thread-roster opens the Preview room identity pill; the Sheet lists the people and the Bot on that room.',
  },
  'thread-roster-add': {
    seed: 'rooms=1',
    clicks: ['.identity', '.kit-sheet--end .add-row'],
    ready: { selector: '.kit-sheet--end .candidate', count: 1 },
    viewport: DEFAULT_VIEWPORT,
    hint: 'thread-roster-add opens Add on the Preview room roster; ?rooms=1 seeds the Member Bot Private notes, which every person there can already open.',
  },
  'onboarding': {
    seed: false,
    thenPath: '/onboarding',
    ready: ONBOARDING_READY,
    viewport: DEFAULT_VIEWPORT,
    hint: `onboarding ${EMPTY_STORE_HINT}`,
  },
  'onboarding-error': {
    seed: false,
    thenPath: '/onboarding',
    fill: [
      { selector: 'input[autocomplete="username"]', text: 'preview' },
      { selector: 'input[autocomplete="new-password"]', index: 0, text: 'preview-owner' },
      { selector: 'input[autocomplete="new-password"]', index: 1, text: 'preview-other' },
    ],
    clicks: ['form [type="submit"]'],
    ready: { ...ONBOARDING_READY, any: ['[role="alert"]'] },
    viewport: DEFAULT_VIEWPORT,
    hint: `onboarding-error types two different passwords and submits. It ${EMPTY_STORE_HINT}`,
  },
  'home-empty': {
    seed: false,
    thenPath: '/onboarding',
    fill: [
      { selector: 'input[autocomplete="username"]', text: 'preview' },
      { selector: 'input[autocomplete="new-password"]', index: 0, text: 'preview-owner' },
      { selector: 'input[autocomplete="new-password"]', index: 1, text: 'preview-owner' },
    ],
    clicks: ['form [type="submit"]'],
    ready: { selector: '.empty .kit-button', count: 1 },
    viewport: DEFAULT_VIEWPORT,
    hint: `home-empty creates the preview Owner through /onboarding and waits for the empty Home. It ${EMPTY_STORE_HINT}`,
  },
  'login': {
    seed: '',
    signOut: true,
    thenPath: '/login',
    ready: { selector: 'input[autocomplete="current-password"]', count: 1 },
    viewport: DEFAULT_VIEWPORT,
  },
  'login-error': {
    seed: '',
    signOut: true,
    thenPath: '/login',
    fill: [
      { selector: 'input[autocomplete="username"]', text: 'preview' },
      { selector: 'input[autocomplete="current-password"]', text: 'not-the-password' },
    ],
    clicks: ['form [type="submit"]'],
    ready: { selector: 'input[autocomplete="current-password"]', count: 1, any: ['[role="alert"]'] },
    viewport: DEFAULT_VIEWPORT,
  },
  'invite': {
    seed: '',
    invite: true,
    ready: { selector: 'input[type="email"][readonly]', count: 1 },
    viewport: DEFAULT_VIEWPORT,
    hint: 'invite issues a fresh Invite as the preview Owner, drops the session cookie, and opens the Invite link.',
  },
  'invite-invalid': {
    seed: false,
    thenPath: '/invite/preview-missing',
    ready: { selector: 'a[href="/login"]', count: 1 },
    viewport: DEFAULT_VIEWPORT,
  },
}

/** Sheets animate in for 180ms. Wait past that before the capture. */
const CLICK_SETTLE_MS = 400

const REQUEST_MS = 15_000
const CHROME_READY_MS = 20_000

export function previewShootStateNames() {
  return Object.keys(PREVIEW_SHOOT_STATES)
}

export function previewShootUsage() {
  const names = previewShootStateNames().join(', ')
  return [
    'usage: pnpm shoot:preview <state> [--narrow]',
    `states: ${names}`,
    '--narrow shoots the state at 390x844 and writes <state>-narrow.png.',
    'Needs a running Host: pnpm preview:host',
    'Then open http://localhost:3000/ (not 127.0.0.1).',
    'PREVIEW_SMOKE_URL (default http://localhost:3000), PREVIEW_SHOOT_DIR (default .preview-shots), CHROME_PATH.',
    'Waits for an explicit ready marker, not network idle.',
  ].join('\n')
}

export function missingHostMessage(base, last) {
  return `preview-shoot: Host did not answer GET /health at ${base} (${last}). Start \`pnpm preview:host\` and open http://localhost:3000/ (not 127.0.0.1).`
}

export function missingChromeMessage() {
  return 'preview-shoot: no Chrome/Chromium on PATH. Set CHROME_PATH to google-chrome or chromium.'
}

export function resolvePreviewShootState(name, { narrow = false } = {}) {
  const key = String(name ?? '').trim()
  const state = PREVIEW_SHOOT_STATES[key]
  if (!state) {
    return null
  }
  if (narrow && state.viewport !== NARROW_VIEWPORT) {
    return { ...state, name: `${key}-narrow`, viewport: NARROW_VIEWPORT }
  }
  return { name: key, ...state }
}

export function previewShootOutputPath(name, dir = DEFAULT_SHOOT_DIR) {
  return join(dir, `${name}.png`)
}

/** `seed: false` opens `thenPath` signed out, with no preview-seed visit. */
export function previewSeedPath(state) {
  if (state.seed === false) {
    return null
  }
  return state.seed ? `/preview-seed?${state.seed}` : '/preview-seed'
}

export function buildReadyExpression(ready) {
  const selector = JSON.stringify(ready.selector)
  const count = ready.count ?? 1
  const any = ready.any ?? []
  const none = ready.none ?? []
  const anyCheck = any.length === 0
    ? 'true'
    : any.map((item) => `document.querySelector(${JSON.stringify(item)})`).join(' || ')
  const noneChecks = none.map((item) => (
    `if (document.querySelector(${JSON.stringify(item)})) { return { ok: false, reason: 'busy' } }`
  )).join('\n')
  return `(() => {
    const nodes = document.querySelectorAll(${selector})
    if (nodes.length < ${count}) {
      return { ok: false, reason: 'count', count: nodes.length }
    }
    ${noneChecks}
    if (!(${anyCheck})) {
      return { ok: false, reason: 'settle' }
    }
    return { ok: true, count: nodes.length }
  })()`
}

export function chromeCandidates(env = process.env) {
  return [
    env.CHROME_PATH,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/opt/google/chrome/chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean)
}

export function resolveChromePath(candidates = chromeCandidates()) {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function note(message) {
  console.error(message)
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function connectionCode(error) {
  const cause = error?.cause
  if (cause?.code) {
    return cause.code
  }
  if (Array.isArray(cause?.errors)) {
    return cause.errors.find((item) => item?.code)?.code
  }
  return error?.code
}

function isRefused(error) {
  const code = connectionCode(error)
  return code === 'ECONNREFUSED' || code === 'EHOSTUNREACH' || code === 'ENOTFOUND' || code === 'EAI_AGAIN'
}

export function ipv6Base(url) {
  const parsed = new URL(url)
  if (parsed.hostname !== 'localhost') {
    return null
  }
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80')
  parsed.host = `[::1]:${port}`
  return parsed.origin
}

async function request(base, path, { method = 'GET' } = {}) {
  const headers = {}
  const ipv6 = ipv6Base(base)
  let response
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_MS),
    })
  } catch (error) {
    if (!isRefused(error) || !ipv6) {
      throw error
    }
    response = await fetch(`${ipv6}${path}`, {
      method,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_MS),
    })
    return { response, base: ipv6 }
  }
  return { response, base }
}

async function waitForHealth(startBase, waitMs) {
  const deadline = Date.now() + waitMs
  let base = startBase
  let last = 'not started'
  while (Date.now() <= deadline) {
    try {
      const hit = await request(base, '/health')
      base = hit.base
      if (hit.response.status === 200) {
        return { base }
      }
      last = `GET /health ${hit.response.status}`
    } catch (error) {
      last = connectionCode(error) ?? error?.message ?? 'unreachable'
    }
    await sleep(400)
  }
  fail(missingHostMessage(base, last))
}

async function assertPreviewGate(base) {
  let head
  try {
    head = await request(base, '/preview-seed', { method: 'HEAD' })
  } catch (error) {
    fail(missingHostMessage(base, connectionCode(error) ?? error?.message ?? 'unreachable'))
  }
  const status = head.response.status
  if (status === 404) {
    fail('preview-shoot: HEAD /preview-seed is 404. The route is closed unless this is nuxt dev with DOSTIGUS_PREVIEW_SEED=1 (`pnpm preview:host`).')
  }
  if (status === 409) {
    fail('preview-shoot: HEAD /preview-seed is 409. This Store Owner is not preview. Point DATABASE_URL at a fresh file (for example file:.data/preview.sqlite) or sign in at /login.')
  }
  if (status !== 204 && status !== 302) {
    fail(`preview-shoot: HEAD /preview-seed expected 204 or 302, got ${status}`)
  }
}

class Cdp {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      const pending = this.pending.get(message.id)
      if (!pending) {
        return
      }
      this.pending.delete(message.id)
      if (message.error) {
        pending.reject(new Error(message.error.message ?? JSON.stringify(message.error)))
        return
      }
      pending.resolve(message.result ?? {})
    })
  }

  static async connect(url) {
    const socket = new WebSocket(url)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true })
      socket.addEventListener('error', () => reject(new Error('preview-shoot: Chrome DevTools websocket failed')), { once: true })
    })
    return new Cdp(socket)
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++
    const payload = { id, method, params }
    if (sessionId) {
      payload.sessionId = sessionId
    }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify(payload))
    })
  }

  close() {
    this.socket.close()
  }
}

async function waitForDevtoolsPort(userDataDir, timeoutMs) {
  const file = join(userDataDir, 'DevToolsActivePort')
  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    if (existsSync(file)) {
      const text = await readFile(file, 'utf8')
      const port = Number(text.split('\n')[0])
      if (Number.isInteger(port) && port > 0) {
        return port
      }
    }
    await sleep(50)
  }
  throw new Error('preview-shoot: Chrome did not open a DevTools port')
}

async function launchChrome(chromePath, viewport) {
  const userDataDir = await mkdtemp(join(tmpdir(), 'dostigus-preview-shoot-'))
  const child = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--force-device-scale-factor=1',
    `--window-size=${viewport.width},${viewport.height}`,
    `--user-data-dir=${userDataDir}`,
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    'about:blank',
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  try {
    const port = await waitForDevtoolsPort(userDataDir, CHROME_READY_MS)
    return { child, port, userDataDir }
  } catch (error) {
    child.kill('SIGKILL')
    await rm(userDataDir, { recursive: true, force: true })
    const detail = stderr.trim().split('\n').at(-1)
    throw new Error(detail ? `${error.message} (${detail})` : error.message)
  }
}

async function stopChrome(launched) {
  if (!launched) {
    return
  }
  launched.child.kill('SIGKILL')
  await Promise.race([
    new Promise((resolve) => {
      launched.child.once('exit', () => resolve())
    }),
    sleep(2000),
  ])
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(launched.userDataDir, { recursive: true, force: true })
      return
    } catch {
      await sleep(100)
    }
  }
}

async function attachPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  await cdp.send('Page.enable', {}, sessionId)
  await cdp.send('Runtime.enable', {}, sessionId)
  return sessionId
}

async function setViewport(cdp, sessionId, viewport) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 600,
  }, sessionId)
}

async function navigate(cdp, sessionId, url) {
  const loaded = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`preview-shoot: navigation timed out: ${url}`)), REQUEST_MS)
    const onMessage = (event) => {
      const message = JSON.parse(String(event.data))
      if (message.method === 'Page.loadEventFired' && (!message.sessionId || message.sessionId === sessionId)) {
        clearTimeout(timer)
        cdp.socket.removeEventListener('message', onMessage)
        resolve()
      }
    }
    cdp.socket.addEventListener('message', onMessage)
  })
  await cdp.send('Page.navigate', { url }, sessionId)
  await loaded
}

async function waitForReady(cdp, sessionId, ready, waitMs, hint) {
  const expression = buildReadyExpression(ready)
  const deadline = Date.now() + waitMs
  let last = { ok: false, reason: 'start' }
  while (Date.now() <= deadline) {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    }, sessionId)
    last = result.result?.value ?? { ok: false, reason: 'evaluate' }
    if (last.ok) {
      return last
    }
    await sleep(150)
  }
  const extra = hint ? ` ${hint}` : ''
  fail(`preview-shoot: ready marker ${ready.selector} did not appear.${extra}`)
}

/** A click before hydration hits server HTML with no handler, so wait for Nuxt first. */
export function buildClickExpression(selector) {
  return `(() => {
    const nuxt = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt
    if (!nuxt || nuxt.isHydrating) {
      return false
    }
    const node = document.querySelector(${JSON.stringify(selector)})
    if (!node) {
      return false
    }
    node.click()
    return true
  })()`
}

export function buildRevealExpression(selector) {
  return `(() => {
    document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'start' })
  })()`
}

export function buildScrollEndExpression(selector) {
  return `(() => {
    const node = document.querySelector(${JSON.stringify(selector)})
    if (node) {
      node.scrollTop = node.scrollHeight
    }
  })()`
}

const HYDRATED_GUARD = `const nuxt = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt
    if (!nuxt || nuxt.isHydrating) {
      return false
    }`

/** Sets a textarea through its native setter so `v-model` sees the input event. */
export function buildTypeExpression(selector, text) {
  return `(() => {
    ${HYDRATED_GUARD}
    const node = document.querySelector(${JSON.stringify(selector)})
    if (!node) {
      return false
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(node, ${JSON.stringify(text)})
    node.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`
}

/** Sets each input through its native setter so `v-model` sees the input event. */
export function buildFillExpression(fields) {
  return `(() => {
    ${HYDRATED_GUARD}
    const fields = ${JSON.stringify(fields)}
    const nodes = fields.map((field) => document.querySelectorAll(field.selector)[field.index ?? 0])
    if (nodes.some((node) => !node)) {
      return false
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    nodes.forEach((node, i) => {
      setter.call(node, fields[i].text)
      node.dispatchEvent(new Event('input', { bubbles: true }))
    })
    return true
  })()`
}

/** Issues an Invite as the signed-in Owner and resolves to the link path. */
export function buildInviteExpression(email) {
  return `fetch('/api/members/invites', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ${JSON.stringify(email)} }),
  }).then(async (response) => {
    if (!response.ok) {
      return { ok: false, status: response.status }
    }
    const issued = await response.json()
    return { ok: true, path: new URL(issued.url).pathname }
  })`
}

/** Hands a file input one drawn PNG and one text file, as a pick would. */
export function buildAttachExpression(selector) {
  return `(() => {
    ${HYDRATED_GUARD}
    const input = document.querySelector(${JSON.stringify(selector)})
    if (!input) {
      return false
    }
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 160
    const g = canvas.getContext('2d')
    g.fillStyle = '#2b2b2b'
    g.fillRect(0, 0, 160, 160)
    g.fillStyle = '#f25630'
    g.beginPath()
    g.arc(80, 80, 44, 0, Math.PI * 2)
    g.fill()
    const bytes = atob(canvas.toDataURL('image/png').split(',')[1])
    const png = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i += 1) {
      png[i] = bytes.charCodeAt(i)
    }
    const list = new DataTransfer()
    list.items.add(new File([png], 'plate.png', { type: 'image/png' }))
    list.items.add(new File(['Pantry: rice, lentils, onions, lemons\\n'], 'pantry-notes.txt', { type: 'text/plain' }))
    input.files = list.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`
}

export function buildClipExpression(selector) {
  return `(() => {
    const node = document.querySelector(${JSON.stringify(selector)})
    if (!node) {
      return null
    }
    const r = node.getBoundingClientRect()
    return { x: r.left, y: r.top, width: r.width, height: r.height }
  })()`
}

async function runWhenReady(cdp, sessionId, expression, label, waitMs) {
  const deadline = Date.now() + waitMs
  while (Date.now() <= deadline) {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    }, sessionId)
    if (result.result?.value === true) {
      await sleep(CLICK_SETTLE_MS)
      return
    }
    await sleep(150)
  }
  fail(`preview-shoot: ${label} did not appear.`)
}

async function clipRect(cdp, sessionId, selector, viewport) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: buildClipExpression(selector),
    returnByValue: true,
  }, sessionId)
  const rect = result.result?.value
  if (!rect) {
    fail(`preview-shoot: clip target ${selector} did not appear.`)
  }
  const x = Math.max(0, rect.x - CLIP_PAD_PX)
  const y = Math.max(0, rect.y - CLIP_PAD_PX)
  return {
    x,
    y,
    width: Math.min(viewport.width, rect.x + rect.width + CLIP_PAD_PX) - x,
    height: Math.min(viewport.height, rect.y + rect.height + CLIP_PAD_PX) - y,
    scale: 2,
  }
}

async function clickWhenReady(cdp, sessionId, selector, waitMs) {
  const expression = buildClickExpression(selector)
  const deadline = Date.now() + waitMs
  while (Date.now() <= deadline) {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    }, sessionId)
    if (result.result?.value === true) {
      await sleep(CLICK_SETTLE_MS)
      return
    }
    await sleep(150)
  }
  fail(`preview-shoot: click target ${selector} did not appear.`)
}

async function issueInvite(cdp, sessionId) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: buildInviteExpression(`preview-invite-${Date.now()}@example.com`),
    awaitPromise: true,
    returnByValue: true,
  }, sessionId)
  const issued = result.result?.value
  if (!issued?.ok) {
    fail(`preview-shoot: POST /api/members/invites answered ${issued?.status ?? 'nothing'} for the preview Owner.`)
  }
  return issued.path
}

async function capturePng(cdp, sessionId, clip) {
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    ...(clip ? { clip } : {}),
  }, sessionId)
  return Buffer.from(shot.data, 'base64')
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const name = argv.find((item) => !item.startsWith('-'))
  if (!name || argv.includes('-h') || argv.includes('--help')) {
    console.error(previewShootUsage())
    process.exit(name ? 0 : 2)
  }
  const state = resolvePreviewShootState(name, { narrow: argv.includes('--narrow') })
  if (!state) {
    console.error(previewShootUsage())
    fail(`preview-shoot: unknown state ${name}`)
  }

  const waitMs = Number(env.PREVIEW_SHOOT_WAIT_MS ?? 60_000)
  const startBase = (env.PREVIEW_SMOKE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const { base } = await waitForHealth(startBase, waitMs)
  await assertPreviewGate(base)

  const chromePath = resolveChromePath(chromeCandidates(env))
  if (!chromePath) {
    fail(missingChromeMessage())
  }

  const outDir = env.PREVIEW_SHOOT_DIR ?? DEFAULT_SHOOT_DIR
  const outPath = isAbsolute(outDir)
    ? previewShootOutputPath(state.name, outDir)
    : previewShootOutputPath(state.name, join(process.cwd(), outDir))

  let launched
  let cdp
  try {
    launched = await launchChrome(chromePath, state.viewport)
    const version = await fetch(`http://127.0.0.1:${launched.port}/json/version`).then((response) => response.json())
    cdp = await Cdp.connect(version.webSocketDebuggerUrl)
    const sessionId = await attachPage(cdp)
    await setViewport(cdp, sessionId, state.viewport)
    const seedPath = previewSeedPath(state)
    if (seedPath) {
      await navigate(cdp, sessionId, `${base}${seedPath}`)
    }
    let thenPath = state.thenPath
    if (state.invite) {
      thenPath = await issueInvite(cdp, sessionId)
    }
    if (state.signOut || state.invite) {
      await cdp.send('Network.deleteCookies', { name: SESSION_COOKIE, url: base }, sessionId)
    }
    if (thenPath) {
      await navigate(cdp, sessionId, `${base}${thenPath}`)
    }
    if (state.fill) {
      await runWhenReady(cdp, sessionId, buildFillExpression(state.fill), `fill target ${state.fill[0].selector}`, waitMs)
    }
    for (const selector of state.clicks ?? []) {
      await clickWhenReady(cdp, sessionId, selector, waitMs)
    }
    if (state.type) {
      await runWhenReady(cdp, sessionId, buildTypeExpression(state.type.selector, state.type.text), `type target ${state.type.selector}`, waitMs)
    }
    if (state.attach) {
      await runWhenReady(cdp, sessionId, buildAttachExpression(state.attach), `file input ${state.attach}`, waitMs)
    }
    await waitForReady(cdp, sessionId, state.ready, waitMs, state.hint)
    if (state.scrollEnd) {
      await cdp.send('Runtime.evaluate', { expression: buildScrollEndExpression(state.scrollEnd) }, sessionId)
    }
    if (state.reveal) {
      await cdp.send('Runtime.evaluate', { expression: buildRevealExpression(state.reveal) }, sessionId)
    }
    if (state.clicks?.length || state.type || state.fill || state.attach || state.reveal) {
      await sleep(CLICK_SETTLE_MS)
    }
    const clip = state.clip ? await clipRect(cdp, sessionId, state.clip, state.viewport) : undefined
    const png = await capturePng(cdp, sessionId, clip)
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, png)
    note(`preview-shoot: wrote ${outPath}`)
    console.log(outPath)
  } finally {
    try {
      cdp?.close()
      await stopChrome(launched)
    } catch (error) {
      note(`preview-shoot: chrome cleanup: ${error?.message ?? error}`)
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    fail(error?.message ?? String(error))
  })
}
