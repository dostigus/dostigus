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
  'providers-empty': {
    seed: 'settings=1',
    thenPath: '/dashboard/providers',
    ready: { selector: '.providers .add', count: 1 },
    viewport: DEFAULT_VIEWPORT,
    hint: 'providers-empty needs a Store with no Provider (use a fresh DATABASE_URL or remove the fixture on the page).',
  },
  'providers-fixture': {
    seed: 'providers=1',
    ready: {
      selector: '.provider',
      count: 1,
      any: ['.shelf .card:not(.skeleton)', '.shelf .banner'],
      none: ['.shelf [aria-busy="true"]'],
    },
    viewport: DEFAULT_VIEWPORT,
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
}

const REQUEST_MS = 15_000
const CHROME_READY_MS = 20_000

export function previewShootStateNames() {
  return Object.keys(PREVIEW_SHOOT_STATES)
}

export function previewShootUsage() {
  const names = previewShootStateNames().join(', ')
  return [
    'usage: pnpm shoot:preview <state>',
    `states: ${names}`,
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

export function resolvePreviewShootState(name) {
  const key = String(name ?? '').trim()
  const state = PREVIEW_SHOOT_STATES[key]
  if (!state) {
    return null
  }
  return { name: key, ...state }
}

export function previewShootOutputPath(name, dir = DEFAULT_SHOOT_DIR) {
  return join(dir, `${name}.png`)
}

export function previewSeedPath(state) {
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

async function capturePng(cdp, sessionId) {
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  }, sessionId)
  return Buffer.from(shot.data, 'base64')
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const name = argv.find((item) => !item.startsWith('-'))
  if (!name || argv.includes('-h') || argv.includes('--help')) {
    console.error(previewShootUsage())
    process.exit(name ? 0 : 2)
  }
  const state = resolvePreviewShootState(name)
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
    await navigate(cdp, sessionId, `${base}${previewSeedPath(state)}`)
    if (state.thenPath) {
      await navigate(cdp, sessionId, `${base}${state.thenPath}`)
    }
    await waitForReady(cdp, sessionId, state.ready, waitMs, state.hint)
    const png = await capturePng(cdp, sessionId)
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
