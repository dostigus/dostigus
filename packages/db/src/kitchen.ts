import type { KitchenCookedEntry, KitchenPantryItem, KitchenRecipe, KitchenSnapshot } from '@dostigus/shared'
import type { OpenedStore } from './store'
import { randomUUID } from 'node:crypto'
import {
  KITCHEN_COOK_XP,
  KitchenInputError,
  parseKitchenCookedLabel,
  parseKitchenIngredients,
  parseKitchenPantryName,
  parseKitchenQty,
  parseKitchenRecipeName,
} from '@dostigus/shared'
import { StoreError } from './queries'

/** One recipe row for the Cluster. Not a second recipe table. */
const RECIPE_ID = 'recipe'

/** Newest cooked rows the Sheet and the MCP surface return. XP sums every row. */
const COOKED_LIST_LIMIT = 12

type PantryRow = {
  id: string
  name: string
  qty: string | null
  created_at: number
}

type CookedRow = {
  id: string
  label: string
  xp: number
  person_id: string | null
  created_at: number
}

type RecipeRow = {
  name: string
  ingredients: string
  updated_at: number
}

function nowMs(): number {
  return Date.now()
}

function asKitchenInput<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    if (error instanceof KitchenInputError) {
      throw new StoreError(error.message, 400)
    }
    throw error
  }
}

function toPantry(row: PantryRow): KitchenPantryItem {
  return {
    id: row.id,
    name: row.name,
    qty: row.qty,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function toCooked(row: CookedRow): KitchenCookedEntry {
  return {
    id: row.id,
    label: row.label,
    xp: row.xp,
    personId: row.person_id,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function toRecipe(row: RecipeRow): KitchenRecipe {
  return {
    name: row.name,
    ingredients: row.ingredients,
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

export function listKitchenPantry(store: OpenedStore): KitchenPantryItem[] {
  const rows = store.sqlite.prepare(`
    SELECT id, name, qty, created_at
    FROM kitchen_pantry
    ORDER BY created_at ASC, rowid ASC
  `).all() as PantryRow[]
  return rows.map(toPantry)
}

export function addKitchenPantry(
  store: OpenedStore,
  input: { name: unknown, qty?: unknown },
): KitchenPantryItem {
  const name = asKitchenInput(() => parseKitchenPantryName(input.name))
  const qty = asKitchenInput(() => parseKitchenQty(input.qty))
  const row: PantryRow = {
    id: randomUUID(),
    name,
    qty,
    created_at: nowMs(),
  }
  store.sqlite.prepare(`
    INSERT INTO kitchen_pantry (id, name, qty, created_at)
    VALUES (?, ?, ?, ?)
  `).run(row.id, row.name, row.qty, row.created_at)
  return toPantry(row)
}

export function listKitchenCooked(store: OpenedStore): KitchenCookedEntry[] {
  const rows = store.sqlite.prepare(`
    SELECT id, label, xp, person_id, created_at
    FROM kitchen_cooked
    ORDER BY created_at DESC, rowid DESC
    LIMIT ?
  `).all(COOKED_LIST_LIMIT) as CookedRow[]
  return rows.map(toCooked)
}

export function kitchenXp(store: OpenedStore): number {
  const row = store.sqlite.prepare(`
    SELECT COALESCE(SUM(xp), 0) AS xp
    FROM kitchen_cooked
  `).get() as { xp: number }
  return row.xp
}

export function markKitchenCooked(
  store: OpenedStore,
  input: { label?: unknown, personId?: string | null },
): KitchenCookedEntry {
  const label = asKitchenInput(() => parseKitchenCookedLabel(input.label))
  const personId = input.personId ?? null
  const row: CookedRow = {
    id: randomUUID(),
    label,
    xp: KITCHEN_COOK_XP,
    person_id: personId,
    created_at: nowMs(),
  }
  store.sqlite.prepare(`
    INSERT INTO kitchen_cooked (id, label, xp, person_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(row.id, row.label, row.xp, row.person_id, row.created_at)
  return toCooked(row)
}

export function getKitchenRecipe(store: OpenedStore): KitchenRecipe | null {
  const row = store.sqlite.prepare(`
    SELECT name, ingredients, updated_at
    FROM kitchen_recipe
    WHERE id = ?
  `).get(RECIPE_ID) as RecipeRow | undefined
  return row ? toRecipe(row) : null
}

export function saveKitchenRecipe(
  store: OpenedStore,
  input: { name: unknown, ingredients?: unknown },
): KitchenRecipe {
  const name = asKitchenInput(() => parseKitchenRecipeName(input.name))
  const ingredients = asKitchenInput(() => parseKitchenIngredients(input.ingredients))
  const updatedAt = nowMs()
  store.sqlite.prepare(`
    INSERT INTO kitchen_recipe (id, name, ingredients, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      ingredients = excluded.ingredients,
      updated_at = excluded.updated_at
  `).run(RECIPE_ID, name, ingredients, updatedAt)
  return {
    name,
    ingredients,
    updatedAt: new Date(updatedAt).toISOString(),
  }
}

export function readKitchen(store: OpenedStore): KitchenSnapshot {
  return {
    pantry: listKitchenPantry(store),
    cooked: listKitchenCooked(store),
    xp: kitchenXp(store),
    recipe: getKitchenRecipe(store),
  }
}
