import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** One self-hosted Cluster (not a git remote). */
export const clusters = sqliteTable('clusters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

/** Portable Bot inside a Cluster. */
export const bots = sqliteTable('bots', {
  id: text('id').primaryKey(),
  clusterId: text('cluster_id').notNull().references(() => clusters.id),
  slug: text('slug').notNull(),
  displayName: text('display_name').notNull(),
  persona: text('persona'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

/** Declarative Module package: schema + MCP surface + Kit bindings. */
export const modules = sqliteTable('modules', {
  id: text('id').primaryKey(),
  botId: text('bot_id').notNull().references(() => bots.id),
  slug: text('slug').notNull(),
  schemaJson: text('schema_json').notNull(),
  mcpContractJson: text('mcp_contract_json').notNull(),
  uiBindingsJson: text('ui_bindings_json').notNull(),
  skillMd: text('skill_md'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export type ClusterRow = typeof clusters.$inferSelect
export type BotRow = typeof bots.$inferSelect
export type ModuleRow = typeof modules.$inferSelect
