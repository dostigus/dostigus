import type { DatabaseSync } from 'node:sqlite'

/** Drizzle-kit style SQL. Embedded so the Host can migrate without a folder path. */
export const CATALOG_STORE_MIGRATIONS = [
  {
    id: '0000_listings',
    sql: `
CREATE TABLE \`catalog_listings\` (
  \`pack_id\` text NOT NULL,
  \`version\` text NOT NULL,
  \`author\` text NOT NULL,
  \`author_link\` text,
  \`title_json\` text NOT NULL,
  \`short_json\` text NOT NULL,
  \`long_json\` text NOT NULL,
  \`screenshots_json\` text DEFAULT '[]' NOT NULL,
  \`assets_json\` text DEFAULT '[]' NOT NULL,
  \`status\` text NOT NULL,
  \`origin_url\` text,
  \`mirror_filename\` text,
  \`sort_order\` integer DEFAULT 0 NOT NULL,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL,
  \`published_at\` integer,
  PRIMARY KEY (\`pack_id\`, \`version\`)
);
CREATE INDEX \`catalog_listings_status_idx\` ON \`catalog_listings\` (\`status\`);
CREATE INDEX \`catalog_listings_sort_idx\` ON \`catalog_listings\` (\`sort_order\`, \`pack_id\`);
CREATE TABLE \`catalog_assets\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`filename\` text NOT NULL,
  \`mime\` text NOT NULL,
  \`byte_size\` integer NOT NULL,
  \`created_at\` integer NOT NULL
);
`,
  },
] as const

export function applyCatalogStoreMigrations(sqlite: DatabaseSync): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __catalog_store_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)

  const applied = new Set(
    sqlite.prepare('SELECT id FROM __catalog_store_migrations').all().map((row) => {
      return String((row as { id: string }).id)
    }),
  )

  const insert = sqlite.prepare(
    'INSERT INTO __catalog_store_migrations (id, applied_at) VALUES (?, ?)',
  )

  for (const migration of CATALOG_STORE_MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue
    }
    sqlite.exec(migration.sql)
    insert.run(migration.id, Date.now())
  }
}
