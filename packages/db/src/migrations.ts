import type { DatabaseSync } from 'node:sqlite'

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
    sqlite.exec(migration.sql)
    insert.run(migration.id, Date.now())
  }
}
