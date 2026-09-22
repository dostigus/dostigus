import { expect, it } from 'vitest'
import {
  BOT_ACCENT_TOKENS,
  BOT_AVATAR_SHAPES,
  botAccentCssVar,
  botGreetingContent,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_SHAPE,
  DEFAULT_BOT_NAME,
  DEFAULT_MODEL_TIER,
  isBotAvatarShape,
  isModelTier,
  MODEL_TIER_LABELS,
  MODEL_TIERS,
  normalizeBotAccentHex,
  PRODUCT_NAME,
} from '../../src/index'

it('exposes cheap, strong, code, and toy tiers', () => {
  expect(MODEL_TIERS).toEqual(['cheap', 'strong', 'code', 'toy'])
  expect(DEFAULT_MODEL_TIER).toBe('strong')
  expect(isModelTier('strong')).toBe(true)
  expect(isModelTier('smart')).toBe(false)
  expect(MODEL_TIER_LABELS.cheap).toContain('Cheap')
  expect(MODEL_TIER_LABELS.strong).toContain('Strong')
  expect(MODEL_TIER_LABELS.code).toContain('Code')
  expect(MODEL_TIER_LABELS.toy).toContain('Toy')
})

it('exposes Bot avatar shapes and the accent palette', () => {
  expect(BOT_AVATAR_SHAPES).toEqual([
    'circle',
    'bean',
    'squircle',
    'capsule',
    'triangle',
    'hex',
    'cloud',
    'teardrop',
  ])
  expect(DEFAULT_AVATAR_SHAPE).toBe('circle')
  expect(DEFAULT_AVATAR_COLOR).toBe('#1F7AE5')
  expect(BOT_ACCENT_TOKENS).toHaveLength(16)
  expect(isBotAvatarShape('hex')).toBe(true)
  expect(isBotAvatarShape('square')).toBe(false)
  expect(normalizeBotAccentHex('#0aac7b')).toBe('#0AAC7B')
  expect(normalizeBotAccentHex('#ffffff')).toBeUndefined()
  expect(botAccentCssVar('#DC4ACD')).toBe('--bot-accent-16')
})

it('keeps the product name Dostigus', () => {
  expect(PRODUCT_NAME).toBe('Dostigus')
})

it('asks what a new Bot is for', () => {
  expect(DEFAULT_BOT_NAME).toBe('New Bot')
  expect(botGreetingContent('New Bot')).toContain('What should this Bot be for?')
})
