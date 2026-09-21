import { expect, it } from 'vitest'
import {
  botGreetingContent,
  DEFAULT_BOT_NAME,
  DEFAULT_MODEL_TIER,
  isModelTier,
  MODEL_TIERS,
  PRODUCT_NAME,
} from '../../src/index'

it('exposes cheap, strong, code, and toy tiers', () => {
  expect(MODEL_TIERS).toEqual(['cheap', 'strong', 'code', 'toy'])
  expect(DEFAULT_MODEL_TIER).toBe('strong')
  expect(isModelTier('strong')).toBe(true)
  expect(isModelTier('smart')).toBe(false)
})

it('keeps the product name Dostigus', () => {
  expect(PRODUCT_NAME).toBe('Dostigus')
})

it('asks what a new Bot is for', () => {
  expect(DEFAULT_BOT_NAME).toBe('New Bot')
  expect(botGreetingContent('New Bot')).toContain('What should this Bot be for?')
})
