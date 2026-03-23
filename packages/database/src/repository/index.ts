import type { Database } from '../database'
import { createAchievementRepository } from './achievement'
import { createMediaItemRepository } from './media-item'
import { createUserRepository } from './user'

export function createRepository(db: Database) {
  return {
    user: createUserRepository(db),
    mediaItem: createMediaItemRepository(db),
    achievement: createAchievementRepository(db),
  }
}

export type Repository = ReturnType<typeof createRepository>
