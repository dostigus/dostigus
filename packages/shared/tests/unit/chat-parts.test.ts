import { expect, it } from 'vitest'
import {
  CHAT_PARTS_MAX,
  chatPartsForRole,
  parseChatParts,
  serializeChatParts,
} from '../../src/index'

const button = {
  kind: 'button' as const,
  label: 'Open demo',
  action: { type: 'openSheet' as const, sheetId: 'demo' },
}

const status = {
  kind: 'status' as const,
  label: 'Preview',
  tone: 'neutral' as const,
}

it('keeps a button and a status and drops the rest', () => {
  expect(parseChatParts([
    status,
    button,
    { kind: 'table', label: 'Nope' },
    { kind: 'button', label: '  ', action: { type: 'openSheet', sheetId: 'demo' } },
    { kind: 'button', label: 'Bad', action: { type: 'openUrl', sheetId: 'demo' } },
    { kind: 'button', label: 'Bad id', action: { type: 'openSheet', sheetId: 'Demo' } },
    { kind: 'status', label: 'Bad tone', tone: 'danger' },
    { kind: 'button', label: '  Trim  ', action: { type: 'openSheet', sheetId: 'demo' } },
  ])).toEqual([
    status,
    button,
    { kind: 'button', label: 'Trim', action: { type: 'openSheet', sheetId: 'demo' } },
  ])
})

it('parses a JSON string and rejects junk', () => {
  expect(parseChatParts(JSON.stringify([button]))).toEqual([button])
  expect(parseChatParts('')).toEqual([])
  expect(parseChatParts('not-json')).toEqual([])
  expect(parseChatParts({ kind: 'button' })).toEqual([])
  expect(parseChatParts(null)).toEqual([])
})

it('keeps a Schedule Card and drops other card kinds', () => {
  const card = {
    kind: 'card' as const,
    card: 'schedule' as const,
    title: 'daily 08:00',
    body: 'уже стоит',
    tone: 'ok' as const,
    targetId: 'sched-1',
    actions: [
      { label: 'Pause', action: { type: 'openSheet' as const, sheetId: 'schedule' } },
    ],
  }
  expect(parseChatParts([
    card,
    { ...card, card: 'module', title: 'Weather' },
    { ...card, card: 'catalog-miss', body: 'Нет такого пакета', targetId: '' },
    { ...card, actions: [{ label: 'Bad', action: { type: 'navigate', sheetId: 'schedule' } }] },
  ])).toEqual([
    card,
    {
      ...card,
      actions: [],
    },
  ])
  expect(chatPartsForRole('user', [card])).toEqual([])
  expect(chatPartsForRole('system', [card])).toEqual([])
  expect(chatPartsForRole('assistant', [card])).toEqual([card])
})

it('caps the list and ignores parts on user and system lines', () => {
  const many = Array.from({ length: CHAT_PARTS_MAX + 3 }, () => status)
  expect(parseChatParts(many)).toHaveLength(CHAT_PARTS_MAX)
  expect(chatPartsForRole('user', [button, status])).toEqual([])
  expect(chatPartsForRole('system', [status])).toEqual([])
  expect(chatPartsForRole('assistant', [button])).toEqual([button])
  expect(serializeChatParts('user', [button])).toBe('[]')
  expect(serializeChatParts('assistant', [status, { kind: 'nope' }])).toBe(JSON.stringify([status]))
})
