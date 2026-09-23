type RecipeBody = {
  name?: string
  ingredients?: string
}

/** Owner or Member may save the one Kitchen recipe. */
export default defineEventHandler(async (event) => {
  const body = await readBody<RecipeBody>(event).catch(() => ({} as RecipeBody))
  try {
    return await withHostStore(event, (store) => saveClusterRecipe(store, {
      name: body?.name,
      ingredients: body?.ingredients,
    }))
  } catch (error) {
    throwStoreError(error)
  }
})
