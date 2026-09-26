import type { DatabaseSync } from 'node:sqlite'
import { LLM_GATEWAY_API_KEY_DROP_ID, migrateLegacyLlmGatewayApiKey } from './llm-gateway-key'

/** Drizzle-kit style SQL (see migrations/0000_bots_and_messages.sql). Embedded so Host can migrate without a folder path. */
export const STORE_MIGRATIONS = [
  {
    id: '0000_bots_and_messages',
    sql: `
CREATE TABLE \`bots\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`name\` text NOT NULL,
  \`model_tier\` text DEFAULT 'strong' NOT NULL,
  \`skills_json\` text DEFAULT '[]' NOT NULL,
  \`modules_json\` text DEFAULT '[]' NOT NULL,
  \`created_at\` integer NOT NULL
);
CREATE TABLE \`messages\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`bot_id\` text NOT NULL,
  \`role\` text NOT NULL,
  \`content\` text NOT NULL,
  \`created_at\` integer NOT NULL,
  FOREIGN KEY (\`bot_id\`) REFERENCES \`bots\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX \`messages_bot_id_created_at_idx\` ON \`messages\` (\`bot_id\`,\`created_at\`);
`,
  },
  {
    id: '0001_llm_gateway',
    sql: `
CREATE TABLE \`llm_gateway\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`base_url\` text,
  \`api_key\` text,
  \`default_tier\` text DEFAULT 'strong' NOT NULL,
  \`models_json\` text DEFAULT '{}' NOT NULL,
  \`updated_at\` integer NOT NULL
);
`,
  },
  {
    id: '0002_owners',
    sql: `
CREATE TABLE \`owners\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`email\` text,
  \`username\` text,
  \`password_hash\` text NOT NULL,
  \`created_at\` integer NOT NULL,
  \`singleton\` integer DEFAULT 1 NOT NULL
);
CREATE UNIQUE INDEX \`owners_email_unique\` ON \`owners\` (\`email\`);
CREATE UNIQUE INDEX \`owners_username_unique\` ON \`owners\` (\`username\`);
CREATE UNIQUE INDEX \`owners_singleton_unique\` ON \`owners\` (\`singleton\`);
`,
  },
  {
    id: '0003_members',
    sql: `
CREATE TABLE \`members\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`display_name\` text NOT NULL,
  \`email\` text,
  \`username\` text,
  \`password_hash\` text NOT NULL,
  \`created_at\` integer NOT NULL,
  \`disabled_at\` integer
);
CREATE UNIQUE INDEX \`members_email_unique\` ON \`members\` (\`email\`);
CREATE UNIQUE INDEX \`members_username_unique\` ON \`members\` (\`username\`);
ALTER TABLE \`messages\` ADD \`person_id\` text;
`,
  },
  {
    id: '0004_bot_avatar',
    sql: `
ALTER TABLE \`bots\` ADD \`avatar_shape\` text DEFAULT 'circle' NOT NULL;
ALTER TABLE \`bots\` ADD \`avatar_color\` text DEFAULT '#1F7AE5' NOT NULL;
`,
  },
  {
    id: '0005_goose_mark_shapes',
    sql: `
UPDATE bots SET avatar_shape = 'round' WHERE avatar_shape = 'circle';
UPDATE bots SET avatar_shape = 'plump' WHERE avatar_shape = 'bean';
UPDATE bots SET avatar_shape = 'squat' WHERE avatar_shape = 'squircle';
UPDATE bots SET avatar_shape = 'tall' WHERE avatar_shape = 'capsule';
UPDATE bots SET avatar_shape = 'lean' WHERE avatar_shape = 'triangle';
UPDATE bots SET avatar_shape = 'chick' WHERE avatar_shape = 'hex';
UPDATE bots SET avatar_shape = 'honk' WHERE avatar_shape = 'cloud';
UPDATE bots SET avatar_shape = 'peek' WHERE avatar_shape = 'teardrop';
`,
  },
  {
    id: '0006_flock_shapes',
    sql: `
UPDATE bots SET avatar_shape = 'goose' WHERE avatar_shape IN ('round', 'circle');
UPDATE bots SET avatar_shape = 'swan' WHERE avatar_shape IN ('tall', 'capsule');
UPDATE bots SET avatar_shape = 'duck' WHERE avatar_shape IN ('squat', 'squircle');
UPDATE bots SET avatar_shape = 'heron' WHERE avatar_shape IN ('lean', 'triangle');
UPDATE bots SET avatar_shape = 'puffin' WHERE avatar_shape IN ('plump', 'bean');
UPDATE bots SET avatar_shape = 'chick' WHERE avatar_shape = 'hex';
UPDATE bots SET avatar_shape = 'parrot' WHERE avatar_shape IN ('honk', 'cloud');
UPDATE bots SET avatar_shape = 'owl' WHERE avatar_shape IN ('peek', 'teardrop');
`,
  },
  {
    id: '0007_bot_label_description',
    sql: `
ALTER TABLE \`bots\` ADD \`label\` text DEFAULT '' NOT NULL;
ALTER TABLE \`bots\` ADD \`description\` text DEFAULT '' NOT NULL;
`,
  },
  {
    id: '0008_member_invites',
    sql: `
CREATE TABLE \`invites\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`token_hash\` text NOT NULL,
  \`email\` text NOT NULL,
  \`expires_at\` integer NOT NULL,
  \`created_by\` text NOT NULL,
  \`created_at\` integer NOT NULL,
  \`used_at\` integer,
  \`revoked_at\` integer,
  FOREIGN KEY (\`created_by\`) REFERENCES \`owners\`(\`id\`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX \`invites_token_hash_unique\` ON \`invites\` (\`token_hash\`);
CREATE INDEX \`invites_email_idx\` ON \`invites\` (\`email\`);
`,
  },
  {
    id: '0009_message_parts',
    sql: `
ALTER TABLE \`messages\` ADD \`parts_json\` text DEFAULT '[]' NOT NULL;
`,
  },
  {
    id: '0010_kitchen',
    sql: `
CREATE TABLE \`kitchen_pantry\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`name\` text NOT NULL,
  \`qty\` text,
  \`created_at\` integer NOT NULL
);
CREATE TABLE \`kitchen_cooked\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`label\` text NOT NULL,
  \`xp\` integer NOT NULL,
  \`person_id\` text,
  \`created_at\` integer NOT NULL
);
CREATE TABLE \`kitchen_recipe\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`name\` text NOT NULL,
  \`ingredients\` text NOT NULL,
  \`updated_at\` integer NOT NULL
);
`,
  },
  {
    id: '0011_bot_visibility_threads',
    sql: `
ALTER TABLE \`bots\` ADD \`visibility\` text DEFAULT 'shared' NOT NULL;
ALTER TABLE \`bots\` ADD \`created_by\` text;
UPDATE \`bots\`
SET \`created_by\` = (
  SELECT \`id\` FROM \`owners\` ORDER BY \`created_at\` ASC, \`id\` ASC LIMIT 1
)
WHERE \`created_by\` IS NULL
  AND EXISTS (SELECT 1 FROM \`owners\`);

CREATE TABLE \`threads\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`kind\` text NOT NULL,
  \`bot_id\` text,
  \`created_at\` integer NOT NULL,
  FOREIGN KEY (\`bot_id\`) REFERENCES \`bots\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX \`threads_bot_id_idx\` ON \`threads\` (\`bot_id\`);

CREATE TABLE \`thread_participants\` (
  \`thread_id\` text NOT NULL,
  \`kind\` text NOT NULL,
  \`ref_id\` text NOT NULL,
  PRIMARY KEY (\`thread_id\`, \`kind\`, \`ref_id\`),
  FOREIGN KEY (\`thread_id\`) REFERENCES \`threads\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX \`thread_participants_kind_ref_idx\` ON \`thread_participants\` (\`kind\`, \`ref_id\`);

ALTER TABLE \`messages\` ADD \`thread_id\` text;
CREATE INDEX \`messages_thread_id_created_at_idx\` ON \`messages\` (\`thread_id\`, \`created_at\`);

DROP TABLE IF EXISTS \`_bot_thread_place\`;
CREATE TEMP TABLE \`_bot_thread_place\` (
  \`message_id\` text PRIMARY KEY NOT NULL,
  \`bot_id\` text NOT NULL,
  \`person_id\` text NOT NULL
);

INSERT INTO \`_bot_thread_place\` (\`message_id\`, \`bot_id\`, \`person_id\`)
WITH \`ordered\` AS (
  SELECT
    \`id\`,
    \`bot_id\`,
    \`role\`,
    \`person_id\`,
    SUM(CASE
      WHEN \`role\` = 'user'
        AND \`person_id\` IS NOT NULL
        AND length(trim(\`person_id\`)) > 0
      THEN 1
      ELSE 0
    END) OVER (
      PARTITION BY \`bot_id\`
      ORDER BY \`created_at\` ASC, \`id\` ASC
    ) AS \`grp\`
  FROM \`messages\`
),
\`keys\` AS (
  SELECT \`bot_id\`, \`grp\`, min(\`person_id\`) AS \`key_person\`
  FROM \`ordered\`
  WHERE \`role\` = 'user'
    AND \`person_id\` IS NOT NULL
    AND length(trim(\`person_id\`)) > 0
  GROUP BY \`bot_id\`, \`grp\`
),
\`owner\` AS (
  SELECT \`id\` AS \`owner_id\`
  FROM \`owners\`
  ORDER BY \`created_at\` ASC, \`id\` ASC
  LIMIT 1
)
SELECT
  \`ordered\`.\`id\`,
  \`ordered\`.\`bot_id\`,
  CASE
    WHEN \`ordered\`.\`grp\` = 0 THEN (SELECT \`owner_id\` FROM \`owner\`)
    ELSE (
      SELECT \`key_person\` FROM \`keys\`
      WHERE \`keys\`.\`bot_id\` = \`ordered\`.\`bot_id\` AND \`keys\`.\`grp\` = \`ordered\`.\`grp\`
    )
  END AS \`person_id\`
FROM \`ordered\`
WHERE \`ordered\`.\`id\` IN (SELECT \`id\` FROM \`messages\` WHERE \`thread_id\` IS NULL)
  AND CASE
    WHEN \`ordered\`.\`grp\` = 0 THEN (SELECT \`owner_id\` FROM \`owner\`)
    ELSE (
      SELECT \`key_person\` FROM \`keys\`
      WHERE \`keys\`.\`bot_id\` = \`ordered\`.\`bot_id\` AND \`keys\`.\`grp\` = \`ordered\`.\`grp\`
    )
  END IS NOT NULL;

INSERT INTO \`threads\` (\`id\`, \`kind\`, \`bot_id\`, \`created_at\`)
SELECT
  'bt:' || \`pairs\`.\`bot_id\` || ':' || \`pairs\`.\`person_id\`,
  'bot',
  \`pairs\`.\`bot_id\`,
  COALESCE((
    SELECT MIN(\`messages\`.\`created_at\`)
    FROM \`messages\`
    INNER JOIN \`_bot_thread_place\` AS \`placed\`
      ON \`placed\`.\`message_id\` = \`messages\`.\`id\`
    WHERE \`placed\`.\`bot_id\` = \`pairs\`.\`bot_id\`
      AND \`placed\`.\`person_id\` = \`pairs\`.\`person_id\`
  ), 0)
FROM (
  SELECT DISTINCT \`bot_id\`, \`person_id\` FROM \`_bot_thread_place\`
) AS \`pairs\`
WHERE NOT EXISTS (
  SELECT 1 FROM \`threads\`
  WHERE \`threads\`.\`id\` = 'bt:' || \`pairs\`.\`bot_id\` || ':' || \`pairs\`.\`person_id\`
);

INSERT OR IGNORE INTO \`thread_participants\` (\`thread_id\`, \`kind\`, \`ref_id\`)
SELECT 'bt:' || \`bot_id\` || ':' || \`person_id\`, 'person', \`person_id\`
FROM (
  SELECT DISTINCT \`bot_id\`, \`person_id\` FROM \`_bot_thread_place\`
);

INSERT OR IGNORE INTO \`thread_participants\` (\`thread_id\`, \`kind\`, \`ref_id\`)
SELECT 'bt:' || \`bot_id\` || ':' || \`person_id\`, 'bot', \`bot_id\`
FROM (
  SELECT DISTINCT \`bot_id\`, \`person_id\` FROM \`_bot_thread_place\`
);

UPDATE \`messages\`
SET \`thread_id\` = (
  SELECT 'bt:' || \`placed\`.\`bot_id\` || ':' || \`placed\`.\`person_id\`
  FROM \`_bot_thread_place\` AS \`placed\`
  WHERE \`placed\`.\`message_id\` = \`messages\`.\`id\`
)
WHERE \`thread_id\` IS NULL
  AND EXISTS (
    SELECT 1 FROM \`_bot_thread_place\` AS \`placed\`
    WHERE \`placed\`.\`message_id\` = \`messages\`.\`id\`
  );

DROP TABLE IF EXISTS \`_bot_thread_place\`;
`,
  },
  {
    id: '0012_messenger_threads',
    sql: `
ALTER TABLE \`threads\` ADD \`title\` text DEFAULT '' NOT NULL;

CREATE TABLE \`messages_new\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`bot_id\` text,
  \`role\` text NOT NULL,
  \`content\` text NOT NULL,
  \`created_at\` integer NOT NULL,
  \`person_id\` text,
  \`parts_json\` text DEFAULT '[]' NOT NULL,
  \`thread_id\` text,
  FOREIGN KEY (\`bot_id\`) REFERENCES \`bots\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO \`messages_new\` (
  \`id\`, \`bot_id\`, \`role\`, \`content\`, \`created_at\`, \`person_id\`, \`parts_json\`, \`thread_id\`
)
SELECT
  \`id\`, \`bot_id\`, \`role\`, \`content\`, \`created_at\`, \`person_id\`, \`parts_json\`, \`thread_id\`
FROM \`messages\`;
DROP TABLE \`messages\`;
ALTER TABLE \`messages_new\` RENAME TO \`messages\`;
CREATE INDEX \`messages_bot_id_created_at_idx\` ON \`messages\` (\`bot_id\`, \`created_at\`);
CREATE INDEX \`messages_thread_id_created_at_idx\` ON \`messages\` (\`thread_id\`, \`created_at\`);
`,
  },
  {
    id: '0013_bot_grants',
    sql: `
CREATE TABLE \`bot_grants\` (
  \`bot_id\` text NOT NULL,
  \`person_id\` text NOT NULL,
  \`created_at\` integer NOT NULL,
  PRIMARY KEY (\`bot_id\`, \`person_id\`),
  FOREIGN KEY (\`bot_id\`) REFERENCES \`bots\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX \`bot_grants_person_id_idx\` ON \`bot_grants\` (\`person_id\`);

INSERT INTO \`bot_grants\` (\`bot_id\`, \`person_id\`, \`created_at\`)
SELECT \`bots\`.\`id\`, \`members\`.\`id\`, \`bots\`.\`created_at\`
FROM \`bots\`
INNER JOIN \`members\`
WHERE \`bots\`.\`visibility\` = 'shared'
  AND (\`bots\`.\`created_by\` IS NULL OR \`members\`.\`id\` != \`bots\`.\`created_by\`);

ALTER TABLE \`bots\` DROP COLUMN \`visibility\`;
`,
  },
  {
    id: '0014_schedules',
    sql: `
CREATE TABLE \`schedules\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`bot_id\` text NOT NULL,
  \`person_id\` text NOT NULL,
  \`cadence\` text NOT NULL,
  \`time_local\` text NOT NULL,
  \`days_of_week_json\` text,
  \`wake_text\` text NOT NULL,
  \`paused\` integer DEFAULT 0 NOT NULL,
  \`next_run_at\` integer NOT NULL,
  \`last_run_at\` integer,
  \`last_run_status\` text,
  \`defer_count\` integer DEFAULT 0 NOT NULL,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL,
  FOREIGN KEY (\`bot_id\`) REFERENCES \`bots\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX \`schedules_paused_next_run_at_idx\` ON \`schedules\` (\`paused\`,\`next_run_at\`);
CREATE INDEX \`schedules_bot_id_person_id_idx\` ON \`schedules\` (\`bot_id\`,\`person_id\`);

CREATE TABLE \`cluster_settings\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`timezone\` text,
  \`updated_at\` integer NOT NULL
);
`,
  },
  {
    id: '0015_turns',
    sql: `
CREATE TABLE \`turns\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`thread_id\` text NOT NULL,
  \`bot_id\` text NOT NULL,
  \`person_id\` text NOT NULL,
  \`trigger\` text NOT NULL,
  \`outcome\` text NOT NULL,
  \`started_at\` integer NOT NULL,
  \`ended_at\` integer,
  \`schedule_id\` text,
  \`error_code\` text,
  \`phases_json\` text DEFAULT '[]' NOT NULL,
  \`tools_json\` text DEFAULT '[]' NOT NULL,
  FOREIGN KEY (\`bot_id\`) REFERENCES \`bots\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX \`turns_started_at_idx\` ON \`turns\` (\`started_at\`);
CREATE INDEX \`turns_bot_started_idx\` ON \`turns\` (\`bot_id\`,\`started_at\`);
CREATE INDEX \`turns_thread_started_idx\` ON \`turns\` (\`thread_id\`,\`started_at\`);
`,
  },
  {
    id: '0016_schedule_name',
    sql: `
ALTER TABLE \`schedules\` ADD \`name\` text DEFAULT '' NOT NULL;
`,
  },
  {
    id: '0017_http_allowlist',
    sql: `
ALTER TABLE \`cluster_settings\` ADD \`http_allowlist\` text;
`,
  },
  {
    id: '0018_artifacts',
    sql: `
CREATE TABLE \`artifacts\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`filename\` text NOT NULL,
  \`mime\` text NOT NULL,
  \`byte_size\` integer NOT NULL,
  \`content_hash\` text NOT NULL,
  \`actor_person_id\` text NOT NULL,
  \`created_at\` integer NOT NULL,
  \`upload_id\` text,
  \`status\` text DEFAULT 'complete' NOT NULL,
  \`last_joined_at\` integer
);
CREATE INDEX \`artifacts_upload_id_hash_idx\` ON \`artifacts\` (\`upload_id\`,\`content_hash\`);
CREATE INDEX \`artifacts_status_created_at_idx\` ON \`artifacts\` (\`status\`,\`created_at\`);
CREATE TABLE \`message_artifacts\` (
  \`message_id\` text NOT NULL,
  \`artifact_id\` text NOT NULL,
  \`created_at\` integer NOT NULL,
  PRIMARY KEY (\`message_id\`, \`artifact_id\`),
  FOREIGN KEY (\`message_id\`) REFERENCES \`messages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (\`artifact_id\`) REFERENCES \`artifacts\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX \`message_artifacts_artifact_id_idx\` ON \`message_artifacts\` (\`artifact_id\`);
`,
  },
  {
    id: '0019_turn_observability',
    sql: `
ALTER TABLE \`turns\` ADD \`model_id\` text;
ALTER TABLE \`turns\` ADD \`model_tier\` text;
ALTER TABLE \`turns\` ADD \`vision_parts\` integer;
`,
  },
  {
    id: '0020_turn_usage',
    sql: `
ALTER TABLE \`turns\` ADD \`served_model_id\` text;
ALTER TABLE \`turns\` ADD \`prompt_tokens\` integer;
ALTER TABLE \`turns\` ADD \`completion_tokens\` integer;
ALTER TABLE \`turns\` ADD \`total_tokens\` integer;
ALTER TABLE \`turns\` ADD \`llm_call_count\` integer;
`,
  },
  {
    id: '0021_llm_providers',
    sql: `
ALTER TABLE \`llm_gateway\` ADD \`providers_json\` text DEFAULT '[]' NOT NULL;
ALTER TABLE \`llm_gateway\` ADD \`tier_binds_json\` text DEFAULT '{}' NOT NULL;
`,
  },
  {
    id: '0022_member_locale',
    sql: `
ALTER TABLE \`members\` ADD \`locale\` text;
UPDATE \`members\` SET \`locale\` = 'en' WHERE \`locale\` IS NULL;
`,
  },
  {
    id: '0023_drop_llm_gateway_api_key',
    sql: `
ALTER TABLE \`llm_gateway\` DROP COLUMN \`api_key\`;
`,
  },
] as const

export function applyStoreMigrations(sqlite: DatabaseSync): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __store_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)

  const applied = new Set(
    sqlite.prepare('SELECT id FROM __store_migrations').all().map((row) => {
      return String((row as { id: string }).id)
    }),
  )

  const insert = sqlite.prepare(
    'INSERT INTO __store_migrations (id, applied_at) VALUES (?, ?)',
  )

  for (const migration of STORE_MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue
    }
    if (migration.id === LLM_GATEWAY_API_KEY_DROP_ID) {
      migrateLegacyLlmGatewayApiKey(sqlite)
    }
    sqlite.exec(migration.sql)
    insert.run(migration.id, Date.now())
  }
}
