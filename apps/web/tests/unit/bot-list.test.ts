import type { BotListItem } from '@dostigus/shared'
import { expect, it } from 'vitest'
import { avatarColor, filterBots, filterBotsByName, initialsFromName } from '../../app/utils/bot-list'

function bot(name: string, preview: string | null): BotListItem {
  return {
    id: name,
    name,
    createdAt: '2026-09-22T00:00:00.000Z',
    createdBy: null,
    installedPackId: null,
    manifest: {
      name,
      modelTier: 'strong',
      avatarShape: 'goose',
      avatarColor: '#1F7AE5',
      label: '',
      description: '',
      skillIds: [],
      modulePackageIds: [],
    },
    lastMessage: preview
      ? { content: preview, createdAt: '2026-09-22T00:00:00.000Z' }
      : null,
  }
}

it('filters Bots by name and latest Chat line', () => {
  const bots = [
    bot('Notes', 'Sort the pantry list'),
    bot('Meal', 'What is for dinner'),
  ]
  expect(filterBots(bots, '').map((item) => item.name)).toEqual(['Notes', 'Meal'])
  expect(filterBots(bots, ' meal ').map((item) => item.name)).toEqual(['Meal'])
  expect(filterBots(bots, 'pantry').map((item) => item.name)).toEqual(['Notes'])
  expect(filterBots(bots, 'missing')).toEqual([])
})

it('filters the picker by Bot name only', () => {
  const bots = [
    bot('Notes', 'Sort the pantry list'),
    bot('Meal', 'What is for dinner'),
  ]
  expect(filterBotsByName(bots, 'note').map((item) => item.name)).toEqual(['Notes'])
  expect(filterBotsByName(bots, 'pantry')).toEqual([])
  expect(filterBotsByName(bots, '  ').map((item) => item.name)).toEqual(['Notes', 'Meal'])
})

it('builds initials and a stable avatar color', () => {
  expect(initialsFromName('New Bot')).toBe('NB')
  expect(initialsFromName('nick')).toBe('NI')
  expect(initialsFromName('  ')).toBe('?')
  expect(avatarColor('alpha')).toBe(avatarColor('alpha'))
  expect(avatarColor('alpha')).toMatch(/^#[0-9a-f]{6}$/)
})
