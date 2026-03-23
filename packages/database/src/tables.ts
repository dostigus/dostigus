import type { MediaStatus, MediaType } from './constants'
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { boolean, index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

// Users

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  locale: text('locale').notNull().default('ru'),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

// Media Items — books, music, movies, games

export const mediaItems = pgTable('media_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').$type<MediaType>().notNull(),
  status: text('status').$type<MediaStatus>().notNull().default('planned'),
  title: text('title').notNull(),
  originalTitle: text('original_title'),
  author: text('author'),
  year: integer('year'),
  coverUrl: text('cover_url'),
  externalId: text('external_id'),
  externalSource: text('external_source'),
  rating: integer('rating'),
  notes: text('notes'),
  tags: text('tags').array().notNull().default([]),
  metadata: text('metadata'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('media_items_user_id_idx').on(t.userId),
  index('media_items_type_idx').on(t.type),
  index('media_items_user_type_idx').on(t.userId, t.type),
])

// Achievements

export const achievements = pgTable('achievements', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  key: text('key').notNull().unique(),
  icon: text('icon').notNull(),
  category: text('category').notNull(),
  maxLevel: integer('max_level').notNull().default(1),
  isAiGenerated: boolean('is_ai_generated').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const achievementTranslations = pgTable('achievement_translations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  achievementId: text('achievement_id').notNull().references(() => achievements.id, { onDelete: 'cascade' }),
  locale: text('locale').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.achievementId, t.locale),
  index('achievement_translations_achievement_id_idx').on(t.achievementId),
])

// User achievements (unlocked)

export const userAchievements = pgTable('user_achievements', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: text('achievement_id').notNull().references(() => achievements.id, { onDelete: 'cascade' }),
  level: integer('level').notNull().default(1),
  progress: integer('progress').notNull().default(0),
  unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.userId, t.achievementId),
  index('user_achievements_user_id_idx').on(t.userId),
])

// Relations

export const usersRelations = relations(users, ({ many }) => ({
  mediaItems: many(mediaItems),
  achievements: many(userAchievements),
}))

export const mediaItemsRelations = relations(mediaItems, ({ one }) => ({
  user: one(users, { fields: [mediaItems.userId], references: [users.id] }),
}))

export const achievementsRelations = relations(achievements, ({ many }) => ({
  translations: many(achievementTranslations),
  userAchievements: many(userAchievements),
}))

export const achievementTranslationsRelations = relations(achievementTranslations, ({ one }) => ({
  achievement: one(achievements, { fields: [achievementTranslations.achievementId], references: [achievements.id] }),
}))

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, { fields: [userAchievements.userId], references: [users.id] }),
  achievement: one(achievements, { fields: [userAchievements.achievementId], references: [achievements.id] }),
}))
