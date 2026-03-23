export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { mediaItem } = useRepository()

  const item = await mediaItem.findById(id)
  if (!item) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  return item
})
