type PantryBody = {
  name?: string
  qty?: string | number | null
}

/** Owner or Member may add a pantry item. */
export default defineEventHandler(async (event) => {
  const body = await readBody<PantryBody>(event).catch(() => ({} as PantryBody))
  try {
    const saved = await withHostStore(event, (store) => addClusterPantry(store, {
      name: body?.name,
      qty: body?.qty,
    }))
    setResponseStatus(event, 201)
    return saved
  } catch (error) {
    throwStoreError(error)
  }
})
