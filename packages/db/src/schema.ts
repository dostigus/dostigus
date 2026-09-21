import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Portable Bot inside the Cluster Store. Manifest fields live on the row. */
export const bots = sqliteTable('bots', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  modelTier: text('model_tier').notNull().default('strong'),
  skillsJson: text('skills_json').notNull().default('[]'),
  modulesJson: text('modules_json').notNull().default('[]'),
  createdAt: integer('created_at').notNull(),
})

/** Chat line for a Bot. */
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('messages_bot_id_created_at_idx').on(table.botId, table.createdAt),
])

export type BotRow = typeof bots.$inferSelect
export type MessageRow = typeof messages.$inferSelect
