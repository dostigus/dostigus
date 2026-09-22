import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Portable Bot inside the Cluster Store. Manifest fields live on the row. */
export const bots = sqliteTable('bots', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  modelTier: text('model_tier').notNull().default('strong'),
  avatarShape: text('avatar_shape').notNull().default('round'),
  avatarColor: text('avatar_color').notNull().default('#1F7AE5'),
  skillsJson: text('skills_json').notNull().default('[]'),
  modulesJson: text('modules_json').notNull().default('[]'),
  createdAt: integer('created_at').notNull(),
})

/** Cluster LLM gateway settings. The API key stays in the Store (server-side only). */
export const llmGateway = sqliteTable('llm_gateway', {
  id: text('id').primaryKey(),
  baseUrl: text('base_url'),
  apiKey: text('api_key'),
  defaultTier: text('default_tier').notNull().default('strong'),
  modelsJson: text('models_json').notNull().default('{}'),
  updatedAt: integer('updated_at').notNull(),
})

/** Single Cluster Owner. Exactly one row (`singleton`). */
export const owners = sqliteTable('owners', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  username: text('username').unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
  singleton: integer('singleton').notNull().default(1).unique(),
})

/** Household Member under the Owner. Sign-in stays off while disabledAt is set. */
export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  email: text('email').unique(),
  username: text('username').unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
  disabledAt: integer('disabled_at'),
})

/** Chat line for a Bot. personId is the Owner or Member on user lines. */
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
  personId: text('person_id'),
}, (table) => [
  index('messages_bot_id_created_at_idx').on(table.botId, table.createdAt),
])

export type BotRow = typeof bots.$inferSelect
export type MessageRow = typeof messages.$inferSelect
export type LlmGatewayRow = typeof llmGateway.$inferSelect
export type OwnerRow = typeof owners.$inferSelect
export type MemberRow = typeof members.$inferSelect
