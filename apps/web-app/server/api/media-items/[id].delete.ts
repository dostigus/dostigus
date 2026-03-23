export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')!
  const { mediaItem } = useRepository()

  const item = await mediaItem.findById(id)
  if (!item) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  if (item.userId !== session.user.id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  await mediaItem.delete(id)

  return { ok: true }
})
