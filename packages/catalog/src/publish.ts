import type { PackTree } from '@dostigus/shared'
import type { CatalogListing } from './listings'
import type { OpenedCatalogStore } from './store'
import {
  assertNoSecretsInPack,
  PackInputError,

  packTreeToZip,
  parsePackId,
  parsePackVersion,
  parsePackZip,
} from '@dostigus/shared'
import { CatalogError } from './catalog-error'
import {

  getListing,
  markListingPublished,
  upsertDraftListing,
} from './listings'
import {
  CATALOG_LONG_MAX,
  CATALOG_SHORT_MAX,
  CATALOG_TITLE_MAX,
  parseCatalogAssetRefs,
  parseCatalogAuthor,
  parseCatalogAuthorLink,
  parseCatalogLocaleText,
  parseCatalogOriginUrl,
  parseCatalogScreenshots,
} from './map'
import {
  catalogMirrorFilename,
  readCatalogDraftMirror,
  writeCatalogDraftMirror,
  writeCatalogMirror,
} from './mirror'

export type CatalogPublishInput = {
  listing: {
    author: unknown
    authorLink?: unknown
    title: unknown
    short: unknown
    long: unknown
    screenshots?: unknown
    assets?: unknown
    originUrl?: unknown
    sortOrder?: unknown
  }
  bytes?: Uint8Array
  tree?: PackTree
  publish?: boolean
}

export type CatalogPublishResult = {
  listing: CatalogListing
  tree: PackTree
}

function asCatalogError(error: unknown): never {
  if (error instanceof CatalogError) {
    throw error
  }
  if (error instanceof PackInputError) {
    throw new CatalogError(error.message, error.statusCode)
  }
  throw error
}

export function catalogTreeFromUpload(input: {
  bytes?: Uint8Array
  tree?: PackTree
}): PackTree {
  try {
    const tree = input.tree ?? parsePackZip(input.bytes ?? new Uint8Array())
    assertNoSecretsInPack(tree)
    return tree
  } catch (error) {
    asCatalogError(error)
  }
}

export function submitCatalogListing(
  store: OpenedCatalogStore,
  input: CatalogPublishInput,
  dirs?: { mirrors?: string },
): CatalogPublishResult {
  try {
    const tree = catalogTreeFromUpload(input)
    const packId = parsePackId(tree.manifest.id)
    const version = parsePackVersion(tree.manifest.version)
    const listing = upsertDraftListing(store, {
      packId,
      version,
      author: parseCatalogAuthor(input.listing.author),
      authorLink: parseCatalogAuthorLink(input.listing.authorLink),
      title: parseCatalogLocaleText(input.listing.title, 'title', CATALOG_TITLE_MAX),
      short: parseCatalogLocaleText(input.listing.short, 'short', CATALOG_SHORT_MAX),
      long: parseCatalogLocaleText(input.listing.long, 'long', CATALOG_LONG_MAX),
      screenshots: parseCatalogScreenshots(input.listing.screenshots),
      assets: parseCatalogAssetRefs(input.listing.assets),
      originUrl: parseCatalogOriginUrl(input.listing.originUrl),
      sortOrder: parseSortOrder(input.listing.sortOrder),
    })
    writeCatalogDraftMirror(store, packId, version, packTreeToZip(tree), dirs?.mirrors)
    if (!input.publish) {
      return { listing, tree }
    }
    return { listing: publishCatalogListing(store, packId, version, tree, dirs), tree }
  } catch (error) {
    asCatalogError(error)
  }
}

function parseSortOrder(value: unknown): number {
  if (value == null || value === '') {
    return 0
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 10_000) {
    throw new CatalogError('sortOrder must be an integer 0–10000', 400)
  }
  return n
}

export function publishCatalogListing(
  store: OpenedCatalogStore,
  packId: string,
  version: string,
  tree?: PackTree,
  dirs?: { mirrors?: string },
): CatalogListing {
  try {
    const id = parsePackId(packId)
    const ver = parsePackVersion(version)
    const existing = getListing(store, id, ver)
    if (!existing) {
      throw new CatalogError('Listing not found', 404)
    }
    if (existing.status === 'published') {
      throw new CatalogError('This version is already published', 409)
    }
    const resolved = tree ?? catalogTreeFromUpload({
      bytes: readCatalogDraftMirror(store, id, ver, dirs?.mirrors),
    })
    if (resolved.manifest.id !== id || resolved.manifest.version !== ver) {
      throw new CatalogError('Pack id and version must match the listing', 400)
    }
    assertNoSecretsInPack(resolved)
    const bytes = packTreeToZip(resolved)
    const written = writeCatalogMirror(store, id, ver, bytes, dirs?.mirrors)
    if (written.filename !== catalogMirrorFilename(id, ver)) {
      throw new CatalogError('Mirror filename mismatch', 500)
    }
    return markListingPublished(store, id, ver, written.filename)
  } catch (error) {
    asCatalogError(error)
  }
}

export function publishCatalogListingFromZip(
  store: OpenedCatalogStore,
  packId: string,
  version: string,
  bytes: Uint8Array,
  dirs?: { mirrors?: string },
): CatalogListing {
  const tree = catalogTreeFromUpload({ bytes })
  if (tree.manifest.id !== parsePackId(packId) || tree.manifest.version !== parsePackVersion(version)) {
    throw new CatalogError('Pack id and version must match the listing', 400)
  }
  return publishCatalogListing(store, packId, version, tree, dirs)
}
