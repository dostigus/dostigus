import { MEDIA_STATUSES, MEDIA_TYPES } from '@dostigus/database'
import { z } from 'zod'

const schema = z.object({
  type: z.enum(MEDIA_TYPES).optional(),
  status: z.enum(MEDIA_STATUSES).optional(),
  title: z.string().min(1).max(500).optional(),
  originalTitle: z.string().max(500).nullish(),
  author: z.string().max(300).nullish(),
  year: z.number().int().min(1).max(2100).nullish(),
  coverUrl: z.string().url().nullish(),
  rating: z.number().int().min(1).max(10).nullish(),
  notes: z.string().max(5000).nullish(),
  tags: z.array(z.string()).max(20).optional(),
  startedAt: z.coerce.date().nullish(),
  completedAt: z.coerce.date().nullish(),
})

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

  const body = await readValidatedBody(event, schema.parse)

  return mediaItem.update(id, body)
})
