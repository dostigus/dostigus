export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const { mediaItem } = useRepository()

  if (!session.user) {
    return []
  }

  return mediaItem.findByUserId(session.user.id, { limit: 20 })
})
