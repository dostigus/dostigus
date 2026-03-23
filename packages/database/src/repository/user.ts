import type { Database } from '../database'
import { desc, eq } from 'drizzle-orm'
import { users } from '../tables'

export function createUserRepository(db: Database) {
  return {
    async findAll() {
      return db.query.users.findMany({
        orderBy: [desc(users.createdAt)],
      })
    },

    async findById(id: string) {
      return db.query.users.findFirst({
        where: eq(users.id, id),
      })
    },

    async findByEmail(email: string) {
      return db.query.users.findFirst({
        where: eq(users.email, email),
      })
    },

    async create(data: typeof users.$inferInsert) {
      const [result] = await db.insert(users).values(data).returning()
      return result
    },

    async update(id: string, data: Partial<typeof users.$inferInsert>) {
      const [result] = await db.update(users).set(data).where(eq(users.id, id)).returning()
      return result
    },
  }
}
