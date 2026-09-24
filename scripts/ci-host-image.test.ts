import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { decideHostImage, hostImageNeeded, isDocsOnlyPath } from './ci-host-image.mjs'

const repoRoot = join(import.meta.dirname, '..')

it('treats docs and markdown as docs-only paths', () => {
  expect(isDocsOnlyPath('docs/adr/0030-chat-cards-module-catalog.md')).toBe(true)
  expect(isDocsOnlyPath('docs/SPEC.md')).toBe(true)
  expect(isDocsOnlyPath('CONTEXT.md')).toBe(true)
  expect(isDocsOnlyPath('AGENTS.md')).toBe(true)
  expect(isDocsOnlyPath('packages/db/README.md')).toBe(true)
  expect(isDocsOnlyPath('./README.md')).toBe(true)
  expect(isDocsOnlyPath('apps/web/server/routes/preview-seed.get.ts')).toBe(false)
  expect(isDocsOnlyPath('Dockerfile')).toBe(false)
  expect(isDocsOnlyPath('.github/workflows/ci.yml')).toBe(false)
  expect(isDocsOnlyPath('package.json')).toBe(false)
})

it('builds the Host image when a successful diff lists no files', () => {
  const lines: string[] = []
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map((part) => String(part)).join(' '))
  })
  try {
    expect(hostImageNeeded([])).toBe(true)
    expect(decideHostImage({
      eventName: 'push',
      ref: 'refs/heads/main',
      baseSha: '34147877',
      files: [],
    })).toBe(true)
    expect(lines.some((line) => line.includes('empty-diff→build') && line.includes('34147877'))).toBe(true)
  } finally {
    spy.mockRestore()
  }
})

it('skips the Host image only when every changed path is docs or markdown', () => {
  expect(hostImageNeeded([
    'docs/adr/0030-chat-cards-module-catalog.md',
    'CONTEXT.md',
    'AGENTS.md',
  ])).toBe(false)
  expect(hostImageNeeded([
    'docs/SPEC.md',
    'packages/db/src/queries.ts',
  ])).toBe(true)
  expect(hostImageNeeded(['Dockerfile'])).toBe(true)
})

it('builds the Host image for tags and a missing base', () => {
  const docs = ['docs/adr/README.md']
  expect(decideHostImage({
    eventName: 'pull_request',
    ref: 'refs/pull/1/merge',
    baseSha: 'abc123',
    files: docs,
  })).toBe(false)
  expect(decideHostImage({
    eventName: 'push',
    ref: 'refs/heads/main',
    baseSha: 'abc123',
    files: ['apps/web/nuxt.config.ts'],
  })).toBe(true)
  expect(decideHostImage({
    eventName: 'push',
    ref: 'refs/tags/v1.2.3',
    baseSha: 'abc123',
    files: docs,
  })).toBe(true)
  expect(decideHostImage({
    eventName: 'pull_request',
    ref: 'refs/pull/1/merge',
    baseSha: '',
    files: docs,
  })).toBe(true)
  expect(decideHostImage({
    eventName: 'push',
    ref: 'refs/heads/main',
    baseSha: '0'.repeat(40),
    files: docs,
  })).toBe(true)
  expect(decideHostImage({
    eventName: 'workflow_dispatch',
    ref: 'refs/heads/main',
    baseSha: 'abc123',
    files: docs,
  })).toBe(true)
})

it('wires the Host image job to the docs-only decision', () => {
  const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8')
  expect(workflow).toContain('node scripts/ci-host-image.mjs')
  expect(workflow).toContain('needs: changes')
  expect(workflow).toContain('needs.changes.outputs.host_image == \'true\'')
  const check = readFileSync(join(repoRoot, 'package.json'), 'utf8')
  expect(check).toContain('node scripts/ensure-installed.mjs && pnpm run lint')
  const hint = readFileSync(join(repoRoot, 'scripts/ensure-installed.mjs'), 'utf8')
  expect(hint).toContain('pnpm install --frozen-lockfile')
})
