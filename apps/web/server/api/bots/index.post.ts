type CreateBody = {
  name?: string
  modelTier?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateBody>(event).catch(() => ({} as CreateBody))
  const created = await withOwnerStore(event, (store) => createClusterBot(store, {
    name: body?.name,
    modelTier: body?.modelTier,
  }))
  setResponseStatus(event, 201)
  return created
})
