/**
 * Kitchen Module field rules. The Store and the MCP surface share these.
 * See ADR 0026. This is not a Meal port.
 */

export const KITCHEN_NAME_MAX = 80
export const KITCHEN_QTY_MAX = 40
export const KITCHEN_INGREDIENTS_MAX = 2_000
export const KITCHEN_COOK_XP = 10
export const KITCHEN_COOKED_LABEL = 'Cooked'

export type KitchenPantryItem = {
  id: string
  name: string
  qty: string | null
  createdAt: string
}

export type KitchenCookedEntry = {
  id: string
  label: string
  xp: number
  personId: string | null
  createdAt: string
}

export type KitchenRecipe = {
  name: string
  ingredients: string
  updatedAt: string
}

export type KitchenSnapshot = {
  pantry: KitchenPantryItem[]
  cooked: KitchenCookedEntry[]
  xp: number
  recipe: KitchenRecipe | null
}

export class KitchenInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KitchenInputError'
  }
}

function parseShortName(value: unknown, what: string): string {
  if (typeof value !== 'string') {
    throw new KitchenInputError(`${what} is required`)
  }
  const name = value.trim()
  if (!name) {
    throw new KitchenInputError(`${what} is required`)
  }
  if (name.length > KITCHEN_NAME_MAX) {
    throw new KitchenInputError(`${what} is too long`)
  }
  return name
}

export function parseKitchenPantryName(value: unknown): string {
  return parseShortName(value, 'Pantry name')
}

export function parseKitchenRecipeName(value: unknown): string {
  return parseShortName(value, 'Recipe name')
}

/** Empty or omitted qty is stored as null. A number becomes text. */
export function parseKitchenQty(value: unknown): string | null {
  if (value == null) {
    return null
  }
  let text: string
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new KitchenInputError('Qty is not a number')
    }
    text = String(value)
  } else if (typeof value === 'string') {
    text = value
  } else {
    throw new KitchenInputError('Qty is text')
  }
  const qty = text.trim()
  if (!qty) {
    return null
  }
  if (qty.length > KITCHEN_QTY_MAX) {
    throw new KitchenInputError('Qty is too long')
  }
  return qty
}

/** Omitted or blank label becomes the default cooked label. */
export function parseKitchenCookedLabel(value: unknown): string {
  if (value == null || value === '') {
    return KITCHEN_COOKED_LABEL
  }
  return parseShortName(value, 'Cooked label')
}

export function parseKitchenIngredients(value: unknown): string {
  if (value == null || value === '') {
    return ''
  }
  if (typeof value !== 'string') {
    throw new KitchenInputError('Ingredients are text')
  }
  const ingredients = value.replace(/\r\n/g, '\n').trim()
  if (ingredients.length > KITCHEN_INGREDIENTS_MAX) {
    throw new KitchenInputError('Ingredients are too long')
  }
  return ingredients
}
