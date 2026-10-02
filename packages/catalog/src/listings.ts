import { parsePackId, parsePackVersion, parseSemver } from '@dostigus/shared'
import { CatalogError } from './catalog-error'
import {
  asListingRecord,
  type CatalogListing,
  type CatalogListingRecord,
  listingColumns,
  toCatalogListing,
} from './map'
import type { OpenedCatalogStore } from './store'

const LISTING_SELECT = listingColumns()

function nowMs(): number {
  return Date.now()
}

export function getListing(
  store: OpenedCatalogStore,
  packId: string,
  version: string,
): CatalogListing | undefined {
  const row = asListingRecord(store.sqlite.prepare(`
    SELECT ${LISTING_SELECT}
    FROM catalog_listings
    WHERE pack_id = ? AND version = ?
  `).get(parsePackId(packId), parsePackVersion(version)))
  return row ? toCatalogListing(row) : undefined
}

export function listListings(
  store: OpenedCatalogStore,
  filter: { status?: CatalogListing['status'] } = {},
): CatalogListing[] {
  const rows = (filter.status
    ? store.sqlite.prepare(`
        SELECT ${LISTING_SELECT}
        FROM catalog_listings
        WHERE status = ?
        ORDER BY sort_order ASC, pack_id ASC, version ASC
      `).all(filter.status)
    : store.sqlite.prepare(`
        SELECT ${LISTING_SELECT}
        FROM catalog_listings
        ORDER BY sort_order ASC, pack_id ASC, version ASC
      `).all()
  ) as unknown[]
  return rows.map((row) => {
    const record = asListingRecord(row)
    if (!record) {
      throw new CatalogError('Catalog listing row is incomplete', 500)
    }
    return toCatalogListing(record)
  })
}

function compareSemverDesc(left: string, right: string): number {
  const a = parseSemver(left)
  const b = parseSemver(right)
  return b.major - a.major || b.minor - a.minor || b.patch - a.patch
}

/** Latest published version per Pack id, Marketplace list order. */
export function listPublishedPacks(store: OpenedCatalogStore): CatalogListing[] {
  const published = listListings(store, { status: 'published' })
  const latest = new Map<string, CatalogListing>()
  for (const listing of published) {
    const current = latest.get(listing.packId)
    if (!current || compareSemverDesc(listing.version, current.version) < 0) {
      latest.set(listing.packId, listing)
    }
  }
  return [...latest.values()].sort((left, right) => {
    return left.sortOrder - right.sortOrder || left.packId.localeCompare(right.packId)
  })
}

export function getPublishedListing(
  store: OpenedCatalogStore,
  packId: string,
  version?: string,
): CatalogListing | undefined {
  const id = parsePackId(packId)
  if (version) {
    const listing = getListing(store, id, parsePackVersion(version))
    return listing?.status === 'published' ? listing : undefined
  }
  return listPublishedPacks(store).find((listing) => listing.packId === id)
}

export function listPublishedVersions(
  store: OpenedCatalogStore,
  packId: string,
): CatalogListing[] {
  const id = parsePackId(packId)
  return listListings(store, { status: 'published' })
    .filter((listing) => listing.packId === id)
    .sort((left, right) => compareSemverDesc(left.version, right.version))
}

export type CatalogListingWrite = {
  packId: string
  version: string
  author: string
  authorLink: string | null
  title: { en: string, ru: string }
  short: { en: string, ru: string }
  long: { en: string, ru: string }
  screenshots: CatalogListing['screenshots']
  assets: CatalogListing['assets']
  originUrl: string | null
  sortOrder: number
}

export function upsertDraftListing(
  store: OpenedCatalogStore,
  write: CatalogListingWrite,
): CatalogListing {
  const existing = getListing(store, write.packId, write.version)
  if (existing?.status === 'published') {
    throw new CatalogError('Published listing versions are immutable', 409)
  }
  const now = nowMs()
  const createdAt = existing?.createdAt ?? now
  store.sqlite.prepare(`
    INSERT INTO catalog_listings (
      pack_id, version, author, author_link, title_json, short_json, long_json,
      screenshots_json, assets_json, status, origin_url, mirror_filename,
      sort_order, created_at, updated_at, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, NULL, ?, ?, ?, NULL)
    ON CONFLICT(pack_id, version) DO UPDATE SET
      author = excluded.author,
      author_link = excluded.author_link,
      title_json = excluded.title_json,
      short_json = excluded.short_json,
      long_json = excluded.long_json,
      screenshots_json = excluded.screenshots_json,
      assets_json = excluded.assets_json,
      origin_url = excluded.origin_url,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `).run(
    write.packId,
    write.version,
    write.author,
    write.authorLink,
    JSON.stringify(write.title),
    JSON.stringify(write.short),
    JSON.stringify(write.long),
    JSON.stringify(write.screenshots),
    JSON.stringify(write.assets),
    write.originUrl,
    write.sortOrder,
    createdAt,
    now,
  )
  const saved = getListing(store, write.packId, write.version)
  if (!saved) {
    throw new CatalogError('Could not save the listing', 500)
  }
  return saved
}

export function markListingPublished(
  store: OpenedCatalogStore,
  packId: string,
  version: string,
  mirrorFilename: string,
  publishedAt = nowMs(),
): CatalogListing {
  const existing = getListing(store, packId, version)
  if (!existing) {
    throw new CatalogError('Listing not found', 404)
  }
  if (existing.status === 'published') {
    throw new CatalogError('This version is already published', 409)
  }
  store.sqlite.prepare(`
    UPDATE catalog_listings
    SET status = 'published',
        mirror_filename = ?,
        published_at = ?,
        updated_at = ?
    WHERE pack_id = ? AND version = ?
  `).run(mirrorFilename, publishedAt, publishedAt, existing.packId, existing.version)
  const saved = getListing(store, packId, version)
  if (!saved) {
    throw new CatalogError('Could not publish the listing', 500)
  }
  return saved
}

export type CatalogListingRecordRow = CatalogListingRecord
