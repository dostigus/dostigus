import { parsePackId, parsePackVersion } from '@dostigus/shared'
import { CatalogError } from './catalog-error'

export const CATALOG_LISTING_STATUSES = ['draft', 'published'] as const
export type CatalogListingStatus = (typeof CATALOG_LISTING_STATUSES)[number]

export type CatalogLocaleText = {
  en: string
  ru: string
}

export type CatalogScreenshot = {
  href: string
  alt: CatalogLocaleText
}

export type CatalogAssetRef = {
  href: string
  kind: 'image' | 'other'
  alt?: CatalogLocaleText
}

export type CatalogListingRecord = {
  pack_id: string
  version: string
  author: string
  author_link: string | null
  title_json: string
  short_json: string
  long_json: string
  screenshots_json: string
  assets_json: string
  status: string
  origin_url: string | null
  mirror_filename: string | null
  sort_order: number
  created_at: number
  updated_at: number
  published_at: number | null
}

export type CatalogAssetRecord = {
  id: string
  filename: string
  mime: string
  byte_size: number
  created_at: number
}

export type CatalogListing = {
  packId: string
  version: string
  author: string
  authorLink: string | null
  title: CatalogLocaleText
  short: CatalogLocaleText
  long: CatalogLocaleText
  screenshots: CatalogScreenshot[]
  assets: CatalogAssetRef[]
  status: CatalogListingStatus
  originUrl: string | null
  mirrorFilename: string | null
  sortOrder: number
  createdAt: number
  updatedAt: number
  publishedAt: number | null
}

export type CatalogAsset = {
  id: string
  filename: string
  mime: string
  byteSize: number
  createdAt: number
}

export const CATALOG_AUTHOR_MAX = 80
export const CATALOG_AUTHOR_LINK_MAX = 500
export const CATALOG_TITLE_MAX = 160
export const CATALOG_SHORT_MAX = 280
export const CATALOG_LONG_MAX = 8_000
export const CATALOG_HREF_MAX = 500
export const CATALOG_ALT_MAX = 160
export const CATALOG_ORIGIN_MAX = 2_000
export const CATALOG_ASSET_FILENAME_MAX = 120
export const CATALOG_ASSET_BYTES_MAX = 2_000_000

const HTTPS_LINK = /^https:\/\/\S+$/i

export function isCatalogListingStatus(value: string): value is CatalogListingStatus {
  return (CATALOG_LISTING_STATUSES as readonly string[]).includes(value)
}

export function parseCatalogLocaleText(
  value: unknown,
  label: string,
  max: number,
  required = true,
): CatalogLocaleText {
  if (typeof value === 'string') {
    const en = value.trim()
    if (!en) {
      if (!required) {
        return { en: '', ru: '' }
      }
      throw new CatalogError(`${label} is required`, 400)
    }
    if (en.length > max) {
      throw new CatalogError(`${label} must be ${max} characters or fewer`, 400)
    }
    return { en, ru: en }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CatalogError(`${label} must be text or { en, ru }`, 400)
  }
  const row = value as { en?: unknown, ru?: unknown }
  if (typeof row.en !== 'string' || !row.en.trim()) {
    if (!required && (row.en == null || row.en === '')) {
      return { en: '', ru: '' }
    }
    throw new CatalogError(`${label}.en is required`, 400)
  }
  const en = row.en.trim()
  if (en.length > max) {
    throw new CatalogError(`${label}.en must be ${max} characters or fewer`, 400)
  }
  const ru = typeof row.ru === 'string' && row.ru.trim() ? row.ru.trim() : en
  if (ru.length > max) {
    throw new CatalogError(`${label}.ru must be ${max} characters or fewer`, 400)
  }
  return { en, ru }
}

export function parseCatalogAuthor(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CatalogError('Author is required', 400)
  }
  const author = value.trim()
  if (author.length > CATALOG_AUTHOR_MAX) {
    throw new CatalogError(`Author must be ${CATALOG_AUTHOR_MAX} characters or fewer`, 400)
  }
  return author
}

export function parseCatalogAuthorLink(value: unknown): string | null {
  if (value == null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    throw new CatalogError('Author link must be an https URL', 400)
  }
  const link = value.trim()
  if (!link) {
    return null
  }
  if (link.length > CATALOG_AUTHOR_LINK_MAX || !HTTPS_LINK.test(link)) {
    throw new CatalogError('Author link must be an https URL', 400)
  }
  return link
}

export function parseCatalogOriginUrl(value: unknown): string | null {
  if (value == null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    throw new CatalogError('Origin URL must be https', 400)
  }
  const url = value.trim()
  if (!url) {
    return null
  }
  if (url.length > CATALOG_ORIGIN_MAX || !HTTPS_LINK.test(url)) {
    throw new CatalogError('Origin URL must be https', 400)
  }
  return url
}

function parseHref(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CatalogError(`${label} href is required`, 400)
  }
  const href = value.trim()
  if (href.length > CATALOG_HREF_MAX) {
    throw new CatalogError(`${label} href is too long`, 400)
  }
  if (href.startsWith('/api/catalog/assets/')) {
    return href
  }
  if (!HTTPS_LINK.test(href)) {
    throw new CatalogError(`${label} href must be https or a Catalog Store asset`, 400)
  }
  return href
}

export function parseCatalogScreenshots(value: unknown): CatalogScreenshot[] {
  if (value == null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new CatalogError('screenshots must be an array', 400)
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new CatalogError(`screenshots[${index}] must be an object`, 400)
    }
    const row = item as { href?: unknown, alt?: unknown }
    return {
      href: parseHref(row.href, `screenshots[${index}]`),
      alt: parseCatalogLocaleText(row.alt ?? '', `screenshots[${index}].alt`, CATALOG_ALT_MAX, false),
    }
  })
}

export function parseCatalogAssetRefs(value: unknown): CatalogAssetRef[] {
  if (value == null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new CatalogError('assets must be an array', 400)
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new CatalogError(`assets[${index}] must be an object`, 400)
    }
    const row = item as { href?: unknown, kind?: unknown, alt?: unknown }
    const kind = row.kind === 'other' ? 'other' : 'image'
    const next: CatalogAssetRef = {
      href: parseHref(row.href, `assets[${index}]`),
      kind,
    }
    if (row.alt != null && row.alt !== '') {
      next.alt = parseCatalogLocaleText(row.alt, `assets[${index}].alt`, CATALOG_ALT_MAX)
    }
    return next
  })
}

function parseJsonArray<T>(raw: string, parse: (value: unknown) => T[]): T[] {
  try {
    return parse(JSON.parse(raw) as unknown)
  } catch (error) {
    if (error instanceof CatalogError) {
      throw error
    }
    return []
  }
}

export function toCatalogListing(row: CatalogListingRecord): CatalogListing {
  if (!isCatalogListingStatus(row.status)) {
    throw new CatalogError('Unknown listing status', 500)
  }
  return {
    packId: parsePackId(row.pack_id),
    version: parsePackVersion(row.version),
    author: row.author,
    authorLink: row.author_link,
    title: parseCatalogLocaleText(JSON.parse(row.title_json) as unknown, 'title', CATALOG_TITLE_MAX),
    short: parseCatalogLocaleText(JSON.parse(row.short_json) as unknown, 'short', CATALOG_SHORT_MAX),
    long: parseCatalogLocaleText(JSON.parse(row.long_json) as unknown, 'long', CATALOG_LONG_MAX),
    screenshots: parseJsonArray(row.screenshots_json, parseCatalogScreenshots),
    assets: parseJsonArray(row.assets_json, parseCatalogAssetRefs),
    status: row.status,
    originUrl: row.origin_url,
    mirrorFilename: row.mirror_filename,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }
}

export function toCatalogAsset(row: CatalogAssetRecord): CatalogAsset {
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    byteSize: row.byte_size,
    createdAt: row.created_at,
  }
}

export function listingColumns(): string {
  return `
    pack_id, version, author, author_link, title_json, short_json, long_json,
    screenshots_json, assets_json, status, origin_url, mirror_filename,
    sort_order, created_at, updated_at, published_at
  `
}

export function asListingRecord(row: unknown): CatalogListingRecord | undefined {
  if (!row || typeof row !== 'object') {
    return undefined
  }
  const value = row as CatalogListingRecord
  if (typeof value.pack_id !== 'string' || typeof value.version !== 'string') {
    return undefined
  }
  return value
}

export function asAssetRecord(row: unknown): CatalogAssetRecord | undefined {
  if (!row || typeof row !== 'object') {
    return undefined
  }
  const value = row as CatalogAssetRecord
  if (typeof value.id !== 'string' || typeof value.filename !== 'string') {
    return undefined
  }
  return value
}
