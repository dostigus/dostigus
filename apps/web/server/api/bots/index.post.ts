type CreateBody = {
  name?: string
  modelTier?: string
  avatarShape?: string
  avatarColor?: string
  label?: string
  description?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateBody>(event).catch(() => ({} as CreateBody))
  const created = await withOwnerStore(event, (store) => createClusterBot(store, {
    name: body?.name,
    modelTier: body?.modelTier,
    avatarShape: body?.avatarShape,
    avatarColor: body?.avatarColor,
    label: body?.label,
    description: body?.description,
  }))
  setResponseStatus(event, 201)
  return created
})
