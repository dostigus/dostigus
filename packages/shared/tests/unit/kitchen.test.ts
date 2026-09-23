import { expect, it } from 'vitest'
import {
  KITCHEN_COOK_XP,
  KITCHEN_COOKED_LABEL,
  KitchenInputError,
  parseKitchenCookedLabel,
  parseKitchenIngredients,
  parseKitchenPantryName,
  parseKitchenQty,
  parseKitchenRecipeName,
} from '../../src/kitchen'

it('parses pantry and recipe names and rejects a blank or a long one', () => {
  expect(parseKitchenPantryName('  Eggs  ')).toBe('Eggs')
  expect(parseKitchenRecipeName('Omelette')).toBe('Omelette')
  expect(() => parseKitchenPantryName('   ')).toThrow(KitchenInputError)
  expect(() => parseKitchenRecipeName('')).toThrow(/Recipe name is required/)
  expect(() => parseKitchenPantryName('e'.repeat(81))).toThrow(/too long/)
})

it('keeps qty optional and stores a number as text', () => {
  expect(parseKitchenQty(undefined)).toBeNull()
  expect(parseKitchenQty('')).toBeNull()
  expect(parseKitchenQty('  6  ')).toBe('6')
  expect(parseKitchenQty(2)).toBe('2')
  expect(() => parseKitchenQty(Number.NaN)).toThrow(KitchenInputError)
  expect(() => parseKitchenQty({ qty: 1 })).toThrow(/Qty is text/)
})

it('defaults a blank cooked label and keeps ingredient lines', () => {
  expect(KITCHEN_COOK_XP).toBe(10)
  expect(parseKitchenCookedLabel(undefined)).toBe(KITCHEN_COOKED_LABEL)
  expect(parseKitchenCookedLabel('  Soup  ')).toBe('Soup')
  expect(parseKitchenIngredients('eggs\r\nmilk\n')).toBe('eggs\nmilk')
  expect(parseKitchenIngredients(null)).toBe('')
})
