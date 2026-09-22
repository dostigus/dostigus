import { expect, it } from 'vitest'
import {
  beakColorFromBody,
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
  LEGACY_AVATAR_SHAPE_MAP,
  migrateBotAvatarShape,
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

it('exposes Goose mark shapes and a hue-ordered accent palette', () => {
  expect(BOT_AVATAR_SHAPES).toEqual([
    'round',
    'tall',
    'squat',
    'lean',
    'plump',
    'chick',
    'honk',
    'peek',
  ])
  expect(DEFAULT_AVATAR_SHAPE).toBe('round')
  expect(DEFAULT_AVATAR_COLOR).toBe('#1F7AE5')
  expect(BOT_ACCENT_TOKENS).toHaveLength(16)
  expect(BOT_ACCENT_TOKENS[0]?.hex).toBe('#E47134')
  expect(BOT_ACCENT_TOKENS[9]?.hex).toBe('#1F7AE5')
  expect(BOT_ACCENT_TOKENS[15]?.hex).toBe('#DE3957')
  expect(isBotAvatarShape('honk')).toBe(true)
  expect(isBotAvatarShape('circle')).toBe(false)
  expect(migrateBotAvatarShape('circle')).toBe('round')
  expect(migrateBotAvatarShape('hex')).toBe('chick')
  expect(LEGACY_AVATAR_SHAPE_MAP.teardrop).toBe('peek')
  expect(normalizeBotAccentHex('#0aac7b')).toBe('#0AAC7B')
  expect(normalizeBotAccentHex('#ffffff')).toBeUndefined()
  expect(botAccentCssVar('#1F7AE5')).toBe('--bot-accent-10')
  expect(botAccentCssVar('#DE3957')).toBe('--bot-accent-16')
  expect(beakColorFromBody('#1F7AE5')).toMatch(/^#[0-9A-F]{6}$/)
  expect(beakColorFromBody('#1F7AE5')).not.toBe('#1F7AE5')
})

it('keeps the product name Dostigus', () => {
  expect(PRODUCT_NAME).toBe('Dostigus')
})

it('asks what a new Bot is for', () => {
  expect(DEFAULT_BOT_NAME).toBe('New Bot')
  expect(botGreetingContent('New Bot')).toContain('What should this Bot be for?')
})
