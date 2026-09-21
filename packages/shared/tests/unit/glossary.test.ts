import { expect, it } from 'vitest'
import {
  botGreetingContent,
  DEFAULT_BOT_NAME,
  DEFAULT_MODEL_TIER,
  isModelTier,
  MODEL_TIER_LABELS,
  MODEL_TIERS,
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

it('keeps the product name Dostigus', () => {
  expect(PRODUCT_NAME).toBe('Dostigus')
})

it('asks what a new Bot is for', () => {
  expect(DEFAULT_BOT_NAME).toBe('New Bot')
  expect(botGreetingContent('New Bot')).toContain('What should this Bot be for?')
})
