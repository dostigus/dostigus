import type { CatalogListing } from './listings'

export type CatalogMirrorPublic = {
  filename: string
  href: string
}

export type CatalogPackPublic = {
  id: string
  version: string
  author: string
  authorLink: string | null
  title: CatalogListing['title']
  short: CatalogListing['short']
  long: CatalogListing['long']
  screenshots: CatalogListing['screenshots']
  assets: CatalogListing['assets']
  status: 'published'
  mirror: CatalogMirrorPublic
  publishedAt: string
}

export function catalogMirrorHref(
  packId: string,
  version: string,
  origin = '',
): string {
  const path = `/api/catalog/packs/${encodeURIComponent(packId)}/versions/${encodeURIComponent(version)}/zip`
  const base = origin.trim().replace(/\/+$/, '')
  return base ? `${base}${path}` : path
}

export function toCatalogPackPublic(
  listing: CatalogListing,
  origin = '',
): CatalogPackPublic {
  if (listing.status !== 'published' || !listing.mirrorFilename || !listing.publishedAt) {
    throw new Error('Only published listings have a public Pack')
  }
  return {
    id: listing.packId,
    version: listing.version,
    author: listing.author,
    authorLink: listing.authorLink,
    title: listing.title,
    short: listing.short,
    long: listing.long,
    screenshots: listing.screenshots,
    assets: listing.assets,
    status: 'published',
    mirror: {
      filename: listing.mirrorFilename,
      href: catalogMirrorHref(listing.packId, listing.version, origin),
    },
    publishedAt: new Date(listing.publishedAt).toISOString(),
  }
}
