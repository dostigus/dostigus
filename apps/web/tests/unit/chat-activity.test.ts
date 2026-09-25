import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import {
  CHAT_ACTIVITY_CONNECT,
  CHAT_ACTIVITY_PHASE_MIN_MS,
  CHAT_ACTIVITY_POLL_MS,
  CHAT_ACTIVITY_THINKING,
  CHAT_ACTIVITY_TOOL,
  CHAT_ACTIVITY_TYPING,
  chatActivityStatus,
  connectActivityLabel,
  noteChatActivityPhase,
  parseChatActivityKind,
} from '../../app/utils/chat-activity'

it('maps a configured reply in flight to thinking until a phase arrives', () => {
  expect(chatActivityStatus({
    pending: true,
    gatewayConfigured: true,
    locale: 'ru',
  })).toEqual({ kind: 'thinking', label: CHAT_ACTIVITY_THINKING })
  expect(chatActivityStatus({
    pending: true,
    gatewayConfigured: true,
  })).toEqual({ kind: 'thinking', label: 'Thinking…' })
  expect(CHAT_ACTIVITY_THINKING).toBe('Думает…')
  expect(CHAT_ACTIVITY_POLL_MS).toBe(400)
  expect(CHAT_ACTIVITY_PHASE_MIN_MS).toBe(300)
})

it('follows the polled phase on the same row', () => {
  expect(chatActivityStatus({
    pending: true,
    gatewayConfigured: true,
    phase: 'tool',
    locale: 'ru',
  })).toEqual({ kind: 'tool', label: CHAT_ACTIVITY_TOOL })
  expect(CHAT_ACTIVITY_TOOL).toBe('Выполняет команду…')
  expect(chatActivityStatus({
    pending: true,
    gatewayConfigured: true,
    phase: 'typing',
    locale: 'ru',
  })).toEqual({ kind: 'typing', label: CHAT_ACTIVITY_TYPING })
  expect(CHAT_ACTIVITY_TYPING).toBe('Печатает…')
})

it('stays quiet when no reply is in flight', () => {
  expect(chatActivityStatus({
    pending: false,
    gatewayConfigured: true,
    phase: 'typing',
  })).toBeNull()
})

it('does not claim typing when the gateway is unset', () => {
  expect(chatActivityStatus({
    pending: true,
    gatewayConfigured: false,
    phase: 'typing',
  })).toBeNull()
})

it('lets a preview force show tool or connect without a live reply', () => {
  expect(chatActivityStatus({
    pending: false,
    gatewayConfigured: false,
    forced: 'command',
    locale: 'ru',
  })).toEqual({ kind: 'tool', label: CHAT_ACTIVITY_TOOL })
  expect(chatActivityStatus({
    pending: false,
    gatewayConfigured: false,
    forced: 'tool',
    locale: 'ru',
  })).toEqual({ kind: 'tool', label: CHAT_ACTIVITY_TOOL })
  expect(chatActivityStatus({
    pending: true,
    gatewayConfigured: true,
    phase: 'thinking',
    forced: 'connect',
    connectTarget: 'Expi',
    locale: 'ru',
  })).toEqual({ kind: 'connect', label: 'Подключается к Expi' })
})

it('drops the connect target when it is blank', () => {
  expect(connectActivityLabel('  ', 'ru')).toBe(CHAT_ACTIVITY_CONNECT)
  expect(connectActivityLabel(null, 'ru')).toBe('Подключается…')
  expect(chatActivityStatus({
    pending: false,
    gatewayConfigured: false,
    forced: 'connect',
    connectTarget: '   ',
    locale: 'ru',
  })?.label).toBe(CHAT_ACTIVITY_CONNECT)
})

it('keeps a long connect target on one short line', () => {
  const label = connectActivityLabel('OpenRouter gateway name that should not run the full width of the thread', 'ru')
  expect(label.startsWith('Подключается к ')).toBe(true)
  expect(label.endsWith('…')).toBe(true)
  expect(label.length).toBeLessThan(80)
})

it('reads preview activity kinds, including the phase names', () => {
  expect(parseChatActivityKind('thinking')).toBe('thinking')
  expect(parseChatActivityKind('tool')).toBe('tool')
  expect(parseChatActivityKind('typing')).toBe('typing')
  expect(parseChatActivityKind('command')).toBe('command')
  expect(parseChatActivityKind('connect')).toBe('connect')
  expect(parseChatActivityKind(['command', 'typing'])).toBe('command')
  expect(parseChatActivityKind('listen')).toBeNull()
  expect(parseChatActivityKind(1)).toBeNull()
  expect(parseChatActivityKind(undefined)).toBeNull()
})

it('holds a phase for the minimum display before switching', () => {
  const started = noteChatActivityPhase({
    shown: 'thinking',
    shownAt: 1_000,
    queued: null,
  }, 'tool', 1_100)
  expect(started.clock.shown).toBe('thinking')
  expect(started.clock.queued).toBe('tool')
  expect(started.waitMs).toBe(200)

  const switched = noteChatActivityPhase(started.clock, 'tool', 1_300)
  expect(switched.clock).toEqual({ shown: 'tool', shownAt: 1_300, queued: null })
  expect(switched.waitMs).toBeNull()
})

it('sweeps the status line and pulses it when motion is reduced', () => {
  const row = readFileSync(join(import.meta.dirname, '../../app/components/ChatActivityRow.vue'), 'utf8')
  expect(row).toContain('class="label"')
  expect(row).toContain('background-color: var(--text-muted)')
  expect(row).toContain('@keyframes activity-label-shimmer')
  expect(row).toContain('background-size: 300% 100%')
  expect(row).toContain('background-repeat: repeat-x')
  expect(row).toMatch(/activity-label-shimmer \{\s*0% \{\s*background-position: 150% 50%;\s*\}\s*100% \{\s*background-position: 0% 50%;/)
  expect(row).toContain('@keyframes activity-label-pulse')
  expect(row).toContain('@media (prefers-reduced-motion: reduce)')
  expect(row).toContain('animation: activity-label-pulse')
  expect(row).not.toContain('Думает')
})

it('keeps the current phase when a poll is idle', () => {
  const noted = noteChatActivityPhase({
    shown: 'tool',
    shownAt: 0,
    queued: null,
  }, null, 500)
  expect(noted.clock.shown).toBe('tool')
  expect(noted.waitMs).toBeNull()
})
