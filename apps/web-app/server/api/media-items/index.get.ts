import { tables } from '@dostigus/database'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const db = useDatabase()

  const items = await db
    .select()
    .from(tables.mediaItems)
    .orderBy(desc(tables.mediaItems.createdAt))
    .limit(20)

  return items
})
