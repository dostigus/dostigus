import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Portable Bot inside the Cluster Store. Manifest fields live on the row. */
export const bots = sqliteTable('bots', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  modelTier: text('model_tier').notNull().default('strong'),
  avatarShape: text('avatar_shape').notNull().default('goose'),
  avatarColor: text('avatar_color').notNull().default('#1F7AE5'),
  label: text('label').notNull().default(''),
  description: text('description').notNull().default(''),
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

/** One-shot Household Invite. tokenHash is the only copy of the secret. */
export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  email: text('email').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdBy: text('created_by').notNull().references(() => owners.id),
  createdAt: integer('created_at').notNull(),
  usedAt: integer('used_at'),
  revokedAt: integer('revoked_at'),
}, (table) => [
  index('invites_email_idx').on(table.email),
])

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

/** Chat line for a Bot. personId is the Owner or Member on user lines. partsJson is assistant Kit parts. */
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
  personId: text('person_id'),
  partsJson: text('parts_json').notNull().default('[]'),
}, (table) => [
  index('messages_bot_id_created_at_idx').on(table.botId, table.createdAt),
])

/** Kitchen Module pantry item. qty is optional text. Cluster-wide, not per Bot. */
export const kitchenPantry = sqliteTable('kitchen_pantry', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  qty: text('qty'),
  createdAt: integer('created_at').notNull(),
})

/** Cooked log. xp on each row sums to the Kitchen XP counter. */
export const kitchenCooked = sqliteTable('kitchen_cooked', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  xp: integer('xp').notNull(),
  personId: text('person_id'),
  createdAt: integer('created_at').notNull(),
})

/** The one Kitchen recipe. id is the singleton `recipe`. */
export const kitchenRecipe = sqliteTable('kitchen_recipe', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ingredients: text('ingredients').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export type BotRow = typeof bots.$inferSelect
export type MessageRow = typeof messages.$inferSelect
export type LlmGatewayRow = typeof llmGateway.$inferSelect
export type OwnerRow = typeof owners.$inferSelect
export type MemberRow = typeof members.$inferSelect
export type InviteRow = typeof invites.$inferSelect
