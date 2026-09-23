import type { OpenedStore } from '@dostigus/db'
import {
  addKitchenPantry,
  markKitchenCooked,
  readKitchen,
  saveKitchenRecipe,
} from '@dostigus/db'

/** Same Store helpers the Kitchen MCP tools and the Host Sheet call. */
export function readClusterKitchen(store: OpenedStore) {
  return { kitchen: readKitchen(store) }
}

export function addClusterPantry(
  store: OpenedStore,
  input: { name: unknown, qty?: unknown },
) {
  const item = addKitchenPantry(store, input)
  return { item, kitchen: readKitchen(store) }
}

export function markClusterCooked(
  store: OpenedStore,
  input: { label?: unknown, personId?: string | null },
) {
  const entry = markKitchenCooked(store, input)
  return { entry, kitchen: readKitchen(store) }
}

export function saveClusterRecipe(
  store: OpenedStore,
  input: { name: unknown, ingredients?: unknown },
) {
  const recipe = saveKitchenRecipe(store, input)
  return { recipe, kitchen: readKitchen(store) }
}
