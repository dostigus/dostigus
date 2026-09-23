import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import {
  PREVIEW_QUIET_HOLD_MS,
  previewChatLocation,
  previewHoldRequested,
  previewQuietHoldMs,
  waitPreviewQuietHold,
} from '../../app/utils/preview-hold'

const quiet = {
  allowed: true,
  hold: '1',
  via: 'stub',
} as const

it('treats hold=1 as the preview pending query', () => {
  expect(previewHoldRequested('1')).toBe(true)
  expect(previewHoldRequested(1)).toBe(true)
  expect(previewHoldRequested(['1'])).toBe(true)
  expect(previewHoldRequested(undefined)).toBe(false)
  expect(previewHoldRequested('true')).toBe(false)
  expect(previewHoldRequested('0')).toBe(false)
  expect(previewHoldRequested('12')).toBe(false)
})

it('keeps hold on the Chat location and leaves other seed redirects alone', () => {
  expect(previewChatLocation('preview', '1')).toBe('/bots/preview?hold=1')
  expect(previewChatLocation('preview', 1)).toBe('/bots/preview?hold=1')
  expect(previewChatLocation('preview', undefined)).toBe('/bots/preview')
  expect(previewChatLocation('preview', 'tall')).toBe('/bots/preview')
})

it('waits only for a preview quiet stub that asked to be held', () => {
  expect(previewQuietHoldMs(quiet)).toBe(PREVIEW_QUIET_HOLD_MS)
  expect(PREVIEW_QUIET_HOLD_MS).toBeGreaterThanOrEqual(8_000)
  expect(previewQuietHoldMs({ ...quiet, allowed: false })).toBe(0)
  expect(previewQuietHoldMs({ ...quiet, hold: undefined })).toBe(0)
  expect(previewQuietHoldMs({ ...quiet, via: 'llm' })).toBe(0)
  expect(previewQuietHoldMs({ ...quiet, via: 'llm+tools' })).toBe(0)
  expect(previewQuietHoldMs({ ...quiet, via: 'error' })).toBe(0)
})

it('does not sleep when the hold is closed', async () => {
  const started = Date.now()
  await waitPreviewQuietHold(0)
  await waitPreviewQuietHold(previewQuietHoldMs({ ...quiet, allowed: false }))
  expect(Date.now() - started).toBeLessThan(500)
})

it('holds the quiet reply on the message route only behind the preview gate', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../server/api/bots/[id]/messages.post.ts'),
    'utf8',
  )
  expect(src).toContain('previewQuietHoldMs')
  expect(src).toContain('waitPreviewQuietHold')
  expect(src).toContain('previewSeedAllowed')
  expect(src).toContain('import.meta.dev')
  expect(src).toContain('DOSTIGUS_PREVIEW_SEED')
  expect(src).toContain('via: reply.via')
  expect(src).not.toContain('setTimeout')
  const chat = readFileSync(
    join(import.meta.dirname, '../../app/pages/bots/[id].vue'),
    'utf8',
  )
  expect(chat).toContain('previewHoldRequested(route.query.hold)')
  expect(chat).toContain('import.meta.dev && previewHoldRequested')
  expect(chat).toContain('hold: \'1\'')
})
