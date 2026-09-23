import { expect, it } from 'vitest'
import {
  CHAT_ACTIVITY_COMMAND,
  CHAT_ACTIVITY_CONNECT,
  CHAT_ACTIVITY_TYPING,
  chatActivityStatus,
  connectActivityLabel,
  parseChatActivityKind,
} from '../../app/utils/chat-activity'

it('maps a configured reply in flight to the typing line', () => {
  expect(chatActivityStatus({
    pending: true,
    gatewayConfigured: true,
  })).toEqual({ kind: 'typing', label: CHAT_ACTIVITY_TYPING })
  expect(CHAT_ACTIVITY_TYPING).toBe('Печатает…')
})

it('stays quiet when no reply is in flight', () => {
  expect(chatActivityStatus({
    pending: false,
    gatewayConfigured: true,
  })).toBeNull()
})

it('does not claim typing when the gateway is unset', () => {
  expect(chatActivityStatus({
    pending: true,
    gatewayConfigured: false,
  })).toBeNull()
})

it('lets a preview force show command or connect without a live reply', () => {
  expect(chatActivityStatus({
    pending: false,
    gatewayConfigured: false,
    forced: 'command',
  })).toEqual({ kind: 'command', label: CHAT_ACTIVITY_COMMAND })
  expect(CHAT_ACTIVITY_COMMAND).toBe('Ожидает завершения команды')
  expect(chatActivityStatus({
    pending: true,
    gatewayConfigured: true,
    forced: 'connect',
    connectTarget: 'Expi',
  })).toEqual({ kind: 'connect', label: 'Подключается к Expi' })
})

it('drops the connect target when it is blank', () => {
  expect(connectActivityLabel('  ')).toBe(CHAT_ACTIVITY_CONNECT)
  expect(connectActivityLabel(null)).toBe('Подключается…')
  expect(chatActivityStatus({
    pending: false,
    gatewayConfigured: false,
    forced: 'connect',
    connectTarget: '   ',
  })?.label).toBe(CHAT_ACTIVITY_CONNECT)
})

it('keeps a long connect target on one short line', () => {
  const label = connectActivityLabel('OpenRouter gateway name that should not run the full width of the thread')
  expect(label.startsWith('Подключается к ')).toBe(true)
  expect(label.endsWith('…')).toBe(true)
  expect(label.length).toBeLessThan(80)
})

it('reads only the known preview activity kinds', () => {
  expect(parseChatActivityKind('typing')).toBe('typing')
  expect(parseChatActivityKind('command')).toBe('command')
  expect(parseChatActivityKind('connect')).toBe('connect')
  expect(parseChatActivityKind(['command', 'typing'])).toBe('command')
  expect(parseChatActivityKind('listen')).toBeNull()
  expect(parseChatActivityKind(1)).toBeNull()
  expect(parseChatActivityKind(undefined)).toBeNull()
})
