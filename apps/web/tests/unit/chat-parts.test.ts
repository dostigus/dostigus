import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { HOST_BOT_SHEET_ID, HOST_DEMO_SHEET_ID, HOST_KITCHEN_SHEET_ID, HOST_SCHEDULE_SHEET_ID, HOST_SKILL_SHEET_ID, hostChatParts, hostSheetById } from '../../app/utils/host-sheets'

const chat = readFileSync(join(import.meta.dirname, '../../app/pages/bots/[id].vue'), 'utf8')

it('renders Kit parts on the assistant bubble and opens a Kit Sheet', () => {
  const bubbleStart = chat.indexOf('v-for="message in timeline"')
  const bubbleEnd = chat.indexOf('</li>', bubbleStart)
  const bubble = chat.slice(bubbleStart, bubbleEnd)
  expect(bubble).toContain('KitChatParts')
  expect(bubble).toContain('hostChatParts(message.parts)')
  expect(bubble).toContain('@open-sheet="(sheetId, targetId) => onOpenSheet(sheetId, targetId, message.botId)"')
  expect(bubble).not.toContain('<button')
  expect(chat).toContain('<KitSheet')
  expect(chat).toContain('v-model:open="sheetOpen"')
  expect(chat).toContain('<KitchenSheet')
  expect(chat).toContain('openSheet?.kind === \'kitchen\'')
  expect(chat).toContain('<ScheduleSheet')
  expect(chat).toContain('openSheet?.kind === \'schedule\'')
  expect(chat).toContain('<SkillSheet')
  expect(chat).toContain('openSheet?.kind === \'skill\'')
  expect(chat).toContain('sheet.kind === \'bot\'')
  expect(chat).toContain('settingsOpen.value = true')
  const room = readFileSync(join(import.meta.dirname, '../../app/pages/threads/[id].vue'), 'utf8')
  expect(room).toContain('KitChatParts')
  expect(room).toContain('<ScheduleSheet')
  expect(room).toContain('openSheet?.kind === \'schedule\'')
  expect(room).toContain('<SkillSheet')
  expect(room).toContain('openSheet?.kind === \'skill\'')
  expect(room).toContain('sheet.kind === \'bot\'')
  expect(room).toContain('<BotSettingsSheet')
})

it('keeps a button only when the Host registry knows the Sheet', () => {
  const demo = hostSheetById(HOST_DEMO_SHEET_ID)
  expect(demo?.title).toBe('Demo sheet')
  expect(demo?.body).toContain('Sheet')
  expect(hostChatParts([
    { kind: 'status', label: 'Preview', tone: 'ok' },
    { kind: 'button', label: 'Pantry', action: { type: 'openSheet', sheetId: 'pantry' } },
    { kind: 'button', label: 'Open demo', action: { type: 'openSheet', sheetId: HOST_DEMO_SHEET_ID } },
  ])).toEqual([
    { kind: 'status', label: 'Preview', tone: 'ok' },
    { kind: 'button', label: 'Open demo', action: { type: 'openSheet', sheetId: 'demo' } },
  ])
  expect(hostSheetById('pantry')).toBeUndefined()
  expect(hostSheetById(HOST_KITCHEN_SHEET_ID)?.kind).toBe('kitchen')
  expect(hostChatParts([
    { kind: 'button', label: 'Open Kitchen', action: { type: 'openSheet', sheetId: 'kitchen' } },
  ])).toEqual([
    { kind: 'button', label: 'Open Kitchen', action: { type: 'openSheet', sheetId: 'kitchen' } },
  ])
  expect(hostSheetById(HOST_SCHEDULE_SHEET_ID)?.kind).toBe('schedule')
  expect(hostSheetById(HOST_SKILL_SHEET_ID)?.kind).toBe('skill')
  expect(hostSheetById(HOST_BOT_SHEET_ID)?.kind).toBe('bot')
  expect(hostSheetById(HOST_BOT_SHEET_ID)?.title).toBe('Параметры')
  expect(hostChatParts([
    {
      kind: 'card',
      card: 'schedule',
      title: 'daily 08:00',
      body: 'уже стоит',
      tone: 'ok',
      targetId: 'sched-1',
      actions: [
        { label: 'Pause', action: { type: 'openSheet', sheetId: 'schedule' } },
        { label: 'Missing', action: { type: 'openSheet', sheetId: 'missing' } },
      ],
    },
  ])).toEqual([
    {
      kind: 'card',
      card: 'schedule',
      title: 'daily 08:00',
      body: 'уже стоит',
      tone: 'ok',
      targetId: 'sched-1',
      actions: [
        { label: 'Pause', action: { type: 'openSheet', sheetId: 'schedule' } },
      ],
    },
  ])
})
