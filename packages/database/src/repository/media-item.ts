import type { MediaStatus, MediaType } from '../constants'
import type { Database } from '../database'
import { and, desc, eq } from 'drizzle-orm'
import { mediaItems } from '../tables'

export function createMediaItemRepository(db: Database) {
  return {
    async findAll(opts?: { type?: MediaType, status?: MediaStatus, limit?: number, offset?: number }) {
      const conditions = [
        opts?.type ? eq(mediaItems.type, opts.type) : undefined,
        opts?.status ? eq(mediaItems.status, opts.status) : undefined,
      ].filter(Boolean)

      return db.query.mediaItems.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        orderBy: [desc(mediaItems.createdAt)],
        limit: opts?.limit,
        offset: opts?.offset,
      })
    },

    async findByUserId(userId: string, opts?: { type?: MediaType, status?: MediaStatus, limit?: number, offset?: number }) {
      const conditions = [
        eq(mediaItems.userId, userId),
        opts?.type ? eq(mediaItems.type, opts.type) : undefined,
        opts?.status ? eq(mediaItems.status, opts.status) : undefined,
      ].filter(Boolean)

      return db.query.mediaItems.findMany({
        where: and(...conditions),
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
