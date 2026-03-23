import type { MediaStatus, MediaType } from '@dostigus/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const { mediaItem } = useRepository()

  if (!session.user) {
    return []
  }

  const query = getQuery(event)
  const type = query.type as MediaType | undefined
  const status = query.status as MediaStatus | undefined

  return mediaItem.findByUserId(session.user.id, { type, status, limit: 100 })
})
