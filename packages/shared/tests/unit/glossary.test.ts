import { expect, it } from 'vitest'
import { MODEL_TIERS } from '../../src/index'

it('exposes cheap, strong, and code tiers', () => {
  expect(MODEL_TIERS).toEqual(['cheap', 'strong', 'code'])
})
