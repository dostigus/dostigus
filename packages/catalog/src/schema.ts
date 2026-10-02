import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * One published (or draft) Marketplace Pack listing version.
 * Catalog Store, not Cluster Store. See ADR 0047.
 */
export const catalogListings = sqliteTable('catalog_listings', {
  packId: text('pack_id').notNull(),
  version: text('version').notNull(),
  author: text('author').notNull(),
  authorLink: text('author_link'),
  titleJson: text('title_json').notNull(),
  shortJson: text('short_json').notNull(),
  longJson: text('long_json').notNull(),
  screenshotsJson: text('screenshots_json').notNull().default('[]'),
  assetsJson: text('assets_json').notNull().default('[]'),
  status: text('status').notNull(),
  originUrl: text('origin_url'),
  mirrorFilename: text('mirror_filename'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  publishedAt: integer('published_at'),
}, (table) => [
  primaryKey({ columns: [table.packId, table.version] }),
  index('catalog_listings_status_idx').on(table.status),
  index('catalog_listings_sort_idx').on(table.sortOrder, table.packId),
])

/** Hosted listing screenshot / asset meta. Bytes live on the volume. */
export const catalogAssets = sqliteTable('catalog_assets', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  byteSize: integer('byte_size').notNull(),
  createdAt: integer('created_at').notNull(),
})

export type CatalogListingRow = typeof catalogListings.$inferSelect
export type CatalogAssetRow = typeof catalogAssets.$inferSelect
