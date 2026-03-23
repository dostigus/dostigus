import { MEDIA_STATUSES, MEDIA_TYPES } from '@dostigus/database'
import { z } from 'zod'

const schema = z.object({
  type: z.enum(MEDIA_TYPES),
  status: z.enum(MEDIA_STATUSES).default('planned'),
  title: z.string().min(1).max(500),
  originalTitle: z.string().max(500).optional(),
  author: z.string().max(300).optional(),
  year: z.number().int().min(1).max(2100).optional(),
  coverUrl: z.string().url().optional(),
  rating: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).max(20).optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readValidatedBody(event, schema.parse)
  const { mediaItem } = useRepository()

  return mediaItem.create({ ...body, userId: session.user.id })
})
