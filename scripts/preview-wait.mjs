/**
 * Poll Host `GET /health` until `{ ok: true }` (`pnpm preview:wait`).
 *
 * `pnpm preview:host` starts `nuxt dev` and does not print a ready
 * line. Agents that curl or open a browser right after that race the
 * listen. `smoke:preview`, `smoke:turns`, and `shoot:preview` already
 * poll `/health`. Use this script before any other tool.
 *
 *   pnpm preview:host
 *   pnpm preview:wait
 *
 * PREVIEW_SMOKE_URL (default http://localhost:3000).
 * PREVIEW_SMOKE_WAIT_MS (default 120000) while nuxt dev is still starting.
 * On this VM open http://localhost:3000/ (not 127.0.0.1). The script
 * retries `[::1]` when `localhost` refuses.
 */
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const DEFAULT_WAIT_MS = 120_000
export const DEFAULT_URL = 'http://localhost:3000'
const REQUEST_MS = 5_000
const POLL_MS = 1_000

export function previewWaitUsage() {
  return [
    'usage: pnpm preview:wait',
    'Polls GET /health until { ok: true }.',
    'Needs a running Host: pnpm preview:host',
    'Then open http://localhost:3000/ (not 127.0.0.1).',
    'PREVIEW_SMOKE_URL (default http://localhost:3000), PREVIEW_SMOKE_WAIT_MS (default 120000).',
  ].join('\n')
}

export function missingHostMessage(base, last) {
  return `preview-wait: Host did not answer GET /health at ${base} (${last}). Start \`pnpm preview:host\` and open http://localhost:3000/ (not 127.0.0.1).`
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

export function isHealthOk(status, text) {
  if (status !== 200) {
    return false
  }
  try {
    return JSON.parse(text)?.ok === true
  } catch {
    return false
  }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function note(message) {
  console.log(message)
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

async function request(base, path) {
  const ipv6 = ipv6Base(base)
  try {
    const response = await fetch(`${base}${path}`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_MS),
    })
    const text = await response.text()
    return { response, text, base }
  } catch (error) {
    if (!isRefused(error) || !ipv6) {
      throw error
    }
    const response = await fetch(`${ipv6}${path}`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_MS),
    })
    const text = await response.text()
    return { response, text, base: ipv6 }
  }
}

export async function waitForHealth(startBase, waitMs) {
  const deadline = Date.now() + waitMs
  let base = startBase
  let last = 'not started'
  while (Date.now() <= deadline) {
    try {
      const hit = await request(base, '/health')
      base = hit.base
      if (isHealthOk(hit.response.status, hit.text)) {
        return { base, text: hit.text }
      }
      last = `GET /health ${hit.response.status}`
    } catch (error) {
      last = connectionCode(error) ?? error?.message ?? 'unreachable'
    }
    await sleep(POLL_MS)
  }
  fail(missingHostMessage(base, last))
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(previewWaitUsage())
    process.exit(0)
  }
  const waitMs = Number(process.env.PREVIEW_SMOKE_WAIT_MS ?? DEFAULT_WAIT_MS)
  const startBase = (process.env.PREVIEW_SMOKE_URL ?? DEFAULT_URL).replace(/\/$/, '')
  const { base } = await waitForHealth(startBase, waitMs)
  note(`preview-wait: GET /health 200 { ok: true } at ${base}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
