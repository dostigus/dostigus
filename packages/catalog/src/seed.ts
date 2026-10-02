import type { CatalogListing } from './listings'
import type { OpenedCatalogStore } from './store'
import { CATALOG_FIXTURES } from './fixtures'
import { getListing } from './listings'
import { submitCatalogListing } from './publish'

/**
 * Publish Kitchen, Mail, and Reader when those versions are still missing.
 * Idempotent. Used by Nick `POST /api/catalog/seed` and unit tests.
 */
export function seedCatalogFixtures(
  store: OpenedCatalogStore,
  dirs?: { mirrors?: string },
): CatalogListing[] {
  const published: CatalogListing[] = []
  for (const fixture of CATALOG_FIXTURES) {
    const existing = getListing(store, fixture.tree.manifest.id, fixture.tree.manifest.version)
    if (existing?.status === 'published') {
      published.push(existing)
      continue
    }
    const result = submitCatalogListing(store, {
      listing: fixture.listing,
      tree: fixture.tree,
      publish: true,
    }, dirs)
    published.push(result.listing)
  }
  return published
}
