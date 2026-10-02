import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export const DEFAULT_CATALOG_STORE_URL = 'file:.data/catalog.sqlite'
export const COMPOSE_CATALOG_STORE_URL = 'file:/var/lib/dostigus/catalog.sqlite'

export function catalogStoreFilePath(databaseUrl: string): string {
  const trimmed = databaseUrl.trim()
  if (trimmed === ':memory:' || trimmed === 'file::memory:') {
    return ':memory:'
  }
  return trimmed.startsWith('file:') ? trimmed.slice('file:'.length) : trimmed
}

/**
 * Immutable Pack mirrors sit next to the Catalog Store file:
 * `.data/catalog-mirrors/{id}-{version}.zip` locally and
 * `/var/lib/dostigus/catalog-mirrors/` on compose. Not Cluster Artifacts.
 */
export function catalogMirrorsDirFromStoreUrl(databaseUrl: string): string {
  const file = catalogStoreFilePath(databaseUrl)
  if (file === ':memory:') {
    return join(tmpdir(), `dostigus-catalog-mirrors-${randomUUID()}`)
  }
  return join(dirname(file), 'catalog-mirrors')
}

/**
 * Listing screenshots and assets we host. Listing ≠ binary — these are
 * not inside the Pack zip. See ADR 0047.
 */
export function catalogAssetsDirFromStoreUrl(databaseUrl: string): string {
  const file = catalogStoreFilePath(databaseUrl)
  if (file === ':memory:') {
    return join(tmpdir(), `dostigus-catalog-assets-${randomUUID()}`)
  }
  return join(dirname(file), 'catalog-assets')
}
