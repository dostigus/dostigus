import type { MediaType } from '../constants'
import type { Database } from '../database'
import { and, desc, eq } from 'drizzle-orm'
import { mediaItems } from '../tables'

export function createMediaItemRepository(db: Database) {
  return {
    async findAll(opts?: { limit?: number, offset?: number }) {
      return db.query.mediaItems.findMany({
        orderBy: [desc(mediaItems.createdAt)],
        limit: opts?.limit,
        offset: opts?.offset,
      })
    },

    async findByUserId(userId: string, opts?: { type?: MediaType, limit?: number, offset?: number }) {
      return db.query.mediaItems.findMany({
        where: opts?.type
          ? and(eq(mediaItems.userId, userId), eq(mediaItems.type, opts.type))
          : eq(mediaItems.userId, userId),
        orderBy: [desc(mediaItems.createdAt)],
        limit: opts?.limit,
        offset: opts?.offset,
      })
    },

    async findById(id: string) {
      return db.query.mediaItems.findFirst({
        where: eq(mediaItems.id, id),
      })
    },

    async create(data: typeof mediaItems.$inferInsert) {
      const [result] = await db.insert(mediaItems).values(data).returning()
      return result
    },

    async update(id: string, data: Partial<typeof mediaItems.$inferInsert>) {
      const [result] = await db.update(mediaItems).set(data).where(eq(mediaItems.id, id)).returning()
      return result
    },

    async delete(id: string) {
      const [result] = await db.delete(mediaItems).where(eq(mediaItems.id, id)).returning()
      return result
    },
  }
}
