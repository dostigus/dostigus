import { KITCHEN_COOK_XP, KITCHEN_COOKED_LABEL } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import {
  addKitchenPantry,
  getKitchenRecipe,
  kitchenXp,
  listKitchenCooked,
  listKitchenPantry,
  markKitchenCooked,
  openStore,
  readKitchen,
  saveKitchenRecipe,
  StoreError,
} from '../../src/index'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('stores pantry items with an optional qty', () => {
  const store = memoryStore()
  const eggs = addKitchenPantry(store, { name: '  Eggs ', qty: '6' })
  const milk = addKitchenPantry(store, { name: 'Milk' })
  expect(eggs.qty).toBe('6')
  expect(milk.qty).toBeNull()
  expect(listKitchenPantry(store).map((item) => item.name)).toEqual(['Eggs', 'Milk'])
  expect(() => addKitchenPantry(store, { name: '   ' })).toThrow(StoreError)
})

it('adds XP on each cooked mark and keeps the newest rows first', () => {
  const store = memoryStore()
  const first = markKitchenCooked(store, { label: 'Omelette', personId: 'owner-1' })
  const second = markKitchenCooked(store, {})
  expect(first.xp).toBe(KITCHEN_COOK_XP)
  expect(first.personId).toBe('owner-1')
  expect(second.label).toBe(KITCHEN_COOKED_LABEL)
  expect(second.personId).toBeNull()
  expect(kitchenXp(store)).toBe(KITCHEN_COOK_XP * 2)
  expect(listKitchenCooked(store).map((entry) => entry.label)).toEqual([
    KITCHEN_COOKED_LABEL,
    'Omelette',
  ])
})

it('saves one recipe and replaces it', () => {
  const store = memoryStore()
  expect(getKitchenRecipe(store)).toBeNull()
  const saved = saveKitchenRecipe(store, {
    name: ' Omelette ',
    ingredients: 'eggs\nmilk',
  })
  expect(saved).toMatchObject({ name: 'Omelette', ingredients: 'eggs\nmilk' })
  const again = saveKitchenRecipe(store, { name: 'Soup', ingredients: '' })
  expect(getKitchenRecipe(store)?.name).toBe('Soup')
  expect(again.ingredients).toBe('')
  expect(readKitchen(store)).toMatchObject({
    xp: 0,
    recipe: { name: 'Soup', ingredients: '' },
    pantry: [],
    cooked: [],
  })
})
