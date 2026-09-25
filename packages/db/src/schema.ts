import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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
  /** Owner or Member id. Access beyond the creator is a grant row, not a flag. */
  createdBy: text('created_by'),
})

/**
 * One explicit Bot grant. The creator and the Owner do not need a row.
 * See ADR 0024.
 */
export const botGrants = sqliteTable('bot_grants', {
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.botId, table.personId] }),
  index('bot_grants_person_id_idx').on(table.personId),
])

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

/**
 * Chat line on a Thread. personId is the Owner or Member on user lines.
 * partsJson is assistant Kit parts. botId is set on a Bot's lines and empty
 * on a person line in a dm, group, or room.
 */
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  /** Person-thread Chat lines need nullable messages.bot_id. */
  botId: text('bot_id').references(() => bots.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
  personId: text('person_id'),
  partsJson: text('parts_json').notNull().default('[]'),
  /** Bot-thread that holds this line. Null only before cutover finishes. */
  threadId: text('thread_id'),
}, (table) => [
  index('messages_bot_id_created_at_idx').on(table.botId, table.createdAt),
  index('messages_thread_id_created_at_idx').on(table.threadId, table.createdAt),
])

/** One Thread. Kind is a label: `dm`, `group`, `bot`, or `room`. */
export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  /** Set for a bot-thread. Cascade-deletes that Thread with the Bot. */
  botId: text('bot_id').references(() => bots.id, { onDelete: 'cascade' }),
  /** Group and room name. Empty on a dm and a bot-thread; the inbox derives those titles. */
  title: text('title').notNull().default(''),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('threads_bot_id_idx').on(table.botId),
])

/** A participant is a person (Owner or Member) or a Bot. */
export const threadParticipants = sqliteTable('thread_participants', {
  threadId: text('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  refId: text('ref_id').notNull(),
}, (table) => [
  primaryKey({ columns: [table.threadId, table.kind, table.refId] }),
  index('thread_participants_kind_ref_idx').on(table.kind, table.refId),
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

/**
 * When the Host wakes a Bot on one person's bot-thread. See ADR 0027.
 * daysOfWeekJson is null for daily and a JSON weekday list for weekly.
 */
export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull(),
  name: text('name').notNull().default(''),
  cadence: text('cadence').notNull(),
  timeLocal: text('time_local').notNull(),
  daysOfWeekJson: text('days_of_week_json'),
  wakeText: text('wake_text').notNull(),
  paused: integer('paused').notNull().default(0),
  nextRunAt: integer('next_run_at').notNull(),
  lastRunAt: integer('last_run_at'),
  lastRunStatus: text('last_run_status'),
  deferCount: integer('defer_count').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('schedules_paused_next_run_at_idx').on(table.paused, table.nextRunAt),
  index('schedules_bot_id_person_id_idx').on(table.botId, table.personId),
])

/**
 * One Host Bot Chat turn. Ops meta only: no message body, tool arguments,
 * or tool results. See ADR 0029.
 */
export const turns = sqliteTable('turns', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull(),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull(),
  trigger: text('trigger').notNull(),
  outcome: text('outcome').notNull(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  scheduleId: text('schedule_id'),
  errorCode: text('error_code'),
  phasesJson: text('phases_json').notNull().default('[]'),
  toolsJson: text('tools_json').notNull().default('[]'),
  /** Id sent after resolveModelId. Null until that resolve. See ADR 0029. */
  modelId: text('model_id'),
  /** Bot Model tier for this Turn. Null until resolve. */
  modelTier: text('model_tier'),
  /** 1 when image parts went on the request. Integer 0/1, like schedules.paused. */
  visionParts: integer('vision_parts'),
}, (table) => [
  index('turns_started_at_idx').on(table.startedAt),
  index('turns_bot_started_idx').on(table.botId, table.startedAt),
  index('turns_thread_started_idx').on(table.threadId, table.startedAt),
])

/** Cluster settings singleton (`cluster`). Null timezone means unset. */
export const clusterSettings = sqliteTable('cluster_settings', {
  id: text('id').primaryKey(),
  timezone: text('timezone'),
  /** JSON array of hostnames. Null or `[]` is allow-all public hosts. */
  httpAllowlist: text('http_allowlist'),
  updatedAt: integer('updated_at').notNull(),
})

/**
 * Persisted Cluster file object. Bytes live on the volume; this row is meta.
 * See ADR 0034.
 */
export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  byteSize: integer('byte_size').notNull(),
  contentHash: text('content_hash').notNull(),
  actorPersonId: text('actor_person_id').notNull(),
  createdAt: integer('created_at').notNull(),
  uploadId: text('upload_id'),
  status: text('status').notNull().default('complete'),
  /** Set on the first message join. Null means never joined (pending). */
  lastJoinedAt: integer('last_joined_at'),
}, (table) => [
  index('artifacts_upload_id_hash_idx').on(table.uploadId, table.contentHash),
  index('artifacts_status_created_at_idx').on(table.status, table.createdAt),
])

/** An Artifact appearing on a Chat message. Attachment is this join. */
export const messageArtifacts = sqliteTable('message_artifacts', {
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  artifactId: text('artifact_id').notNull().references(() => artifacts.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.messageId, table.artifactId] }),
  index('message_artifacts_artifact_id_idx').on(table.artifactId),
])

export type BotRow = typeof bots.$inferSelect
export type BotGrantRow = typeof botGrants.$inferSelect
export type MessageRow = typeof messages.$inferSelect
export type ThreadRow = typeof threads.$inferSelect
export type ThreadParticipantRow = typeof threadParticipants.$inferSelect
export type LlmGatewayRow = typeof llmGateway.$inferSelect
export type OwnerRow = typeof owners.$inferSelect
export type MemberRow = typeof members.$inferSelect
export type InviteRow = typeof invites.$inferSelect
export type ScheduleRow = typeof schedules.$inferSelect
export type TurnRow = typeof turns.$inferSelect
export type ClusterSettingsRow = typeof clusterSettings.$inferSelect
export type ArtifactRow = typeof artifacts.$inferSelect
export type MessageArtifactRow = typeof messageArtifacts.$inferSelect
