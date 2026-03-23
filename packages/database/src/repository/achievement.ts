import type { Database } from '../database'
import { and, eq } from 'drizzle-orm'
import { achievements, achievementTranslations, userAchievements } from '../tables'

export function createAchievementRepository(db: Database) {
  return {
    async findAll() {
      return db.query.achievements.findMany({
        with: { translations: true },
      })
    },

    async findById(id: string) {
      return db.query.achievements.findFirst({
        where: eq(achievements.id, id),
        with: { translations: true },
      })
    },

    async findByKey(key: string) {
      return db.query.achievements.findFirst({
        where: eq(achievements.key, key),
        with: { translations: true },
      })
    },

    async create(data: typeof achievements.$inferInsert) {
      const [result] = await db.insert(achievements).values(data).returning()
      return result
    },

    async createTranslation(data: typeof achievementTranslations.$inferInsert) {
      const [result] = await db.insert(achievementTranslations).values(data).returning()
      return result
    },

    async findUserAchievements(userId: string) {
      return db.query.userAchievements.findMany({
        where: eq(userAchievements.userId, userId),
        with: { achievement: { with: { translations: true } } },
      })
    },

    async unlock(data: typeof userAchievements.$inferInsert) {
      const [result] = await db.insert(userAchievements).values(data).returning()
      return result
    },

    async updateProgress(userId: string, achievementId: string, progress: number) {
      const [result] = await db.update(userAchievements)
        .set({ progress })
        .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)))
        .returning()
      return result
    },
  }
}
