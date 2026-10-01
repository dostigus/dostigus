import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import {
  DEFAULT_URL,
  DEFAULT_WAIT_MS,
  ipv6Base,
  isHealthOk,
  missingHostMessage,
  previewWaitUsage,
} from './preview-wait.mjs'

const agents = readFileSync(join(import.meta.dirname, '..', 'AGENTS.md'), 'utf8')
const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'))

it('exposes preview:wait next to preview:host', () => {
  expect(pkg.scripts['preview:wait']).toBe('node scripts/preview-wait.mjs')
  expect(pkg.scripts['preview:host']).toContain('DOSTIGUS_PREVIEW_SEED=1')
})

it('documents the /health poll for agents', () => {
  const usage = previewWaitUsage()
  expect(usage).toContain('pnpm preview:wait')
  expect(usage).toContain('GET /health')
  expect(usage).toContain('{ ok: true }')
  expect(usage).toContain('pnpm preview:host')
  expect(usage).toContain('PREVIEW_SMOKE_URL')
  expect(usage).toContain('PREVIEW_SMOKE_WAIT_MS')
  expect(usage).toContain('not 127.0.0.1')
  expect(DEFAULT_URL).toBe('http://localhost:3000')
  expect(DEFAULT_WAIT_MS).toBe(120_000)
})

it('treats GET /health 200 { ok: true } as ready', () => {
  expect(isHealthOk(200, '{"ok":true}')).toBe(true)
  expect(isHealthOk(200, '{\n  "ok": true\n}')).toBe(true)
  expect(isHealthOk(204, '{"ok":true}')).toBe(false)
  expect(isHealthOk(200, '{"ok":false}')).toBe(false)
  expect(isHealthOk(200, 'ok')).toBe(false)
  expect(isHealthOk(404, '{"ok":true}')).toBe(false)
})

it('tells the agent to start preview:host when the Host is down', () => {
  expect(missingHostMessage('http://localhost:3000', 'ECONNREFUSED')).toContain('pnpm preview:host')
  expect(missingHostMessage('http://localhost:3000', 'ECONNREFUSED')).toContain('not 127.0.0.1')
})

it('rewrites localhost to IPv6 the same way the preview smoke does', () => {
  expect(ipv6Base('http://localhost:3000')).toBe('http://[::1]:3000')
  expect(ipv6Base('http://127.0.0.1:3000')).toBeNull()
})

it('documents preview:wait and the Kit locale symlink in AGENTS.md', () => {
  expect(agents).toContain('pnpm preview:wait')
  expect(agents).toContain('GET /health')
  expect(agents).toContain('apps/web/i18n/locales')
  expect(agents).toContain('symlink')
  expect(agents).toContain('packages/ui-kit/locales')
  expect(agents).not.toContain('Keep those two JSON trees byte-identical')
})
