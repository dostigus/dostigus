import { expect, it } from 'vitest'
import {
  CHAT_LLM_HISTORY_LIMIT,
  chatExpandKeywordHit,
  chatLlmHistory,
} from '../../src/index'

function line(id: string, role: 'user' | 'assistant' | 'system', content: string) {
  return { id, role, content }
}

it('windows Chat history to the last 40 lines and keeps role system', () => {
  const history = Array.from({ length: 42 }, (_, index) => {
    const n = index + 1
    return line(`m${n}`, n % 2 === 0 ? 'user' : 'assistant', `line ${n}`)
  })
  history[0] = line('wake', 'system', 'Morning briefing')
  const windowed = chatLlmHistory(history)
  expect(windowed).toHaveLength(CHAT_LLM_HISTORY_LIMIT)
  expect(windowed[0]).toEqual({ role: 'assistant', content: 'line 3' })
  expect(windowed.at(-1)).toEqual({ role: 'user', content: 'line 42' })
  expect(windowed.some((message) => message.role === 'system')).toBe(false)

  const short = [
    line('wake', 'system', 'Morning briefing'),
    line('u1', 'user', 'Hi'),
  ]
  expect(chatLlmHistory(short)).toEqual([
    { role: 'system', content: 'Morning briefing' },
    { role: 'user', content: 'Hi' },
  ])
})

it('always includes the triggering line when it falls outside the window', () => {
  const history = Array.from({ length: 41 }, (_, index) =>
    line(`m${index + 1}`, 'user', `line ${index + 1}`))
  const trigger = line('wake', 'system', 'Morning briefing')
  const windowed = chatLlmHistory(history, trigger)
  expect(windowed).toHaveLength(CHAT_LLM_HISTORY_LIMIT + 1)
  expect(windowed[0]).toEqual({ role: 'system', content: 'Morning briefing' })
  expect(windowed.at(-1)).toEqual({ role: 'user', content: 'line 41' })
})

it('hits expand keywords on the current user line only', () => {
  expect(chatExpandKeywordHit('rename this Bot')).toBe(true)
  expect(chatExpandKeywordHit('Смени название')).toBe(true)
  expect(chatExpandKeywordHit('новое имя')).toBe(true)
  expect(chatExpandKeywordHit('Add a LABEL')).toBe(true)
  expect(chatExpandKeywordHit('поставь метка')).toBe(true)
  expect(chatExpandKeywordHit('update description')).toBe(true)
  expect(chatExpandKeywordHit('поправь описание')).toBe(true)
  expect(chatExpandKeywordHit('add a Skill')).toBe(true)
  expect(chatExpandKeywordHit('новые skills')).toBe(true)
  expect(chatExpandKeywordHit('добавь навык')).toBe(true)
  expect(chatExpandKeywordHit('open the allowlist')).toBe(true)
  expect(chatExpandKeywordHit('Marketplace later')).toBe(true)
  expect(chatExpandKeywordHit('set the timezone')).toBe(true)
  expect(chatExpandKeywordHit('какая таймзона')).toBe(true)
  expect(chatExpandKeywordHit('self-settings please')).toBe(true)
  expect(chatExpandKeywordHit('настрой бота тихо')).toBe(true)
  expect(chatExpandKeywordHit('открой параметры')).toBe(true)
  expect(chatExpandKeywordHit('каждое утро в 08:00')).toBe(false)
  expect(chatExpandKeywordHit('')).toBe(false)
})
