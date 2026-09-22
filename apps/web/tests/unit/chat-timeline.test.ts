import { expect, it } from 'vitest'
import { showsBotPurposeCard, withOptimisticUser } from '../../app/utils/chat-timeline'

it('appends the optimistic user line until the stored line replaces it', () => {
  const stored = [{ id: 'm1', role: 'assistant', content: 'Hello' }]
  const pending = { id: 'pending-1', role: 'user', content: 'Soup tonight' }

  expect(withOptimisticUser(stored, null)).toEqual(stored)
  expect(withOptimisticUser(stored, pending)).toEqual([...stored, pending])
  expect(withOptimisticUser([...stored, pending], pending)).toEqual([...stored, pending])
})

it('shows the purpose Card until the first user line', () => {
  expect(showsBotPurposeCard([])).toBe(false)
  expect(showsBotPurposeCard([{ role: 'assistant' }])).toBe(true)
  expect(showsBotPurposeCard([
    { role: 'assistant' },
    { role: 'user' },
  ])).toBe(false)
  expect(showsBotPurposeCard([{ role: 'user' }])).toBe(false)
})
