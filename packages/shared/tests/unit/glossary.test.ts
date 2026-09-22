import { expect, it } from 'vitest'
import {
  BOT_ACCENT_TOKENS,
  BOT_AVATAR_SHAPE_LABELS,
  BOT_AVATAR_SHAPES,
  BOT_AVATAR_STATES,
  botAccentCssVar,
  botGreetingContent,
  botMarkPalette,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_SHAPE,
  DEFAULT_BOT_NAME,
  DEFAULT_MODEL_TIER,
  isBotAvatarShape,
  isBotAvatarState,
  isModelTier,
  LEGACY_AVATAR_SHAPE_MAP,
  migrateBotAvatarShape,
  MODEL_TIER_LABELS,
  MODEL_TIERS,
  normalizeBotAccentHex,
  ONE_SHOT_AVATAR_STATES,
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

it('exposes the flock shapes and a hue-ordered accent palette', () => {
  expect(BOT_AVATAR_SHAPES).toEqual([
    'goose',
    'duck',
    'swan',
    'chick',
    'parrot',
    'heron',
    'puffin',
    'owl',
  ])
  expect(DEFAULT_AVATAR_SHAPE).toBe('goose')
  expect(BOT_AVATAR_SHAPE_LABELS.puffin).toBe('Puffin')
  expect(DEFAULT_AVATAR_COLOR).toBe('#1F7AE5')
  expect(BOT_ACCENT_TOKENS).toHaveLength(16)
  expect(BOT_ACCENT_TOKENS[0]?.hex).toBe('#E47134')
  expect(BOT_ACCENT_TOKENS[9]?.hex).toBe('#1F7AE5')
  expect(BOT_ACCENT_TOKENS[15]?.hex).toBe('#DE3957')
  expect(isBotAvatarShape('owl')).toBe(true)
  expect(isBotAvatarShape('honk')).toBe(false)
  expect(normalizeBotAccentHex('#0aac7b')).toBe('#0AAC7B')
  expect(normalizeBotAccentHex('#ffffff')).toBeUndefined()
  expect(botAccentCssVar('#1F7AE5')).toBe('--bot-accent-10')
  expect(botAccentCssVar('#DE3957')).toBe('--bot-accent-16')
})

it('migrates both older shape generations onto a bird', () => {
  expect(migrateBotAvatarShape('circle')).toBe('goose')
  expect(migrateBotAvatarShape('round')).toBe('goose')
  expect(migrateBotAvatarShape('hex')).toBe('chick')
  expect(migrateBotAvatarShape('honk')).toBe('parrot')
  expect(migrateBotAvatarShape('teardrop')).toBe('owl')
  expect(migrateBotAvatarShape('nonsense')).toBe('goose')
  expect(LEGACY_AVATAR_SHAPE_MAP.peek).toBe('owl')
  expect(LEGACY_AVATAR_SHAPE_MAP.plump).toBe('puffin')
})

it('exposes nine mark motion states, two of them one-shot', () => {
  expect(BOT_AVATAR_STATES).toEqual([
    'none',
    'idle',
    'think',
    'reply',
    'work',
    'greet',
    'listen',
    'celebrate',
    'error',
    'sleep',
  ])
  expect(ONE_SHOT_AVATAR_STATES).toEqual(['greet', 'celebrate'])
  for (const state of ONE_SHOT_AVATAR_STATES) {
    expect(isBotAvatarState(state)).toBe(true)
  }
  expect(isBotAvatarState('sleep')).toBe(true)
  expect(isBotAvatarState('dance')).toBe(false)
})

it('derives mark tones that stay apart from the body on every accent', () => {
  for (const { hex } of BOT_ACCENT_TOKENS) {
    const palette = botMarkPalette(hex)
    expect(palette.body).toBe(hex)
    for (const tone of [palette.shade, palette.light, palette.beak]) {
      expect(tone).toMatch(/^#[0-9A-F]{6}$/)
      expect(tone).not.toBe(palette.body)
    }
    expect(palette.ink).toBe('#17140F')
  }
  expect(botMarkPalette('#ffffff').body).toBe(DEFAULT_AVATAR_COLOR)
})

it('keeps the product name Dostigus', () => {
  expect(PRODUCT_NAME).toBe('Dostigus')
})

it('asks what a new Bot is for', () => {
  expect(DEFAULT_BOT_NAME).toBe('New Bot')
  expect(botGreetingContent('New Bot')).toContain('What should this Bot be for?')
})
