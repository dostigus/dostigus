import type { CatalogAsset } from './map'
import type { OpenedCatalogStore } from './store'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePackId, parsePackVersion } from '@dostigus/shared'
import { CatalogError } from './catalog-error'
import {
  asAssetRecord,
  CATALOG_ASSET_BYTES_MAX,
  CATALOG_ASSET_FILENAME_MAX,

  toCatalogAsset,
} from './map'

const MIRROR_NAME = /^[a-z0-9][a-z0-9-]{0,31}\.[a-z0-9][a-z0-9-]{0,31}-\d+\.\d+\.\d+\.zip$/

export function catalogMirrorFilename(packId: string, version: string): string {
  return `${parsePackId(packId)}-${parsePackVersion(version)}.zip`
}

export function catalogMirrorsDir(store: OpenedCatalogStore, override?: string): string {
  return override?.trim() || store.mirrorsDir
}

export function catalogAssetsDir(store: OpenedCatalogStore, override?: string): string {
  return override?.trim() || store.assetsDir
}

export function catalogMirrorPath(
  store: OpenedCatalogStore,
  filename: string,
  override?: string,
): string {
  if (!MIRROR_NAME.test(filename)) {
    throw new CatalogError('Unknown mirror filename', 400)
  }
  return join(catalogMirrorsDir(store, override), filename)
}

export function catalogDraftMirrorFilename(packId: string, version: string): string {
  return `${catalogMirrorFilename(packId, version)}.draft`
}

export function writeCatalogDraftMirror(
  store: OpenedCatalogStore,
  packId: string,
  version: string,
  bytes: Uint8Array,
  override?: string,
): { filename: string, path: string } {
  const filename = catalogDraftMirrorFilename(packId, version)
  const dir = catalogMirrorsDir(store, override)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, filename)
  writeFileSync(path, bytes)
  return { filename, path }
}

export function readCatalogDraftMirror(
  store: OpenedCatalogStore,
  packId: string,
  version: string,
  override?: string,
): Uint8Array {
  const filename = catalogDraftMirrorFilename(packId, version)
  const path = join(catalogMirrorsDir(store, override), filename)
  try {
    return new Uint8Array(readFileSync(path))
  } catch {
    throw new CatalogError('Pack zip is required to publish', 400)
  }
}

/**
 * Write an immutable `{id}-{version}.zip`. Refuses overwrite.
 * Not a Cluster Artifact.
 */
export function writeCatalogMirror(
  store: OpenedCatalogStore,
  packId: string,
  version: string,
  bytes: Uint8Array,
  override?: string,
): { filename: string, path: string, sha256: string } {
  const filename = catalogMirrorFilename(packId, version)
  const dir = catalogMirrorsDir(store, override)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, filename)
  try {
    readFileSync(path)
    throw new CatalogError('Mirror zip is immutable', 409)
  } catch (error) {
    if (error instanceof CatalogError) {
      throw error
    }
  }
  const tmp = join(dir, `.${filename}.${randomUUID()}.tmp`)
  try {
    writeFileSync(tmp, bytes)
    renameSync(tmp, path)
  } catch (error) {
    rmSync(tmp, { force: true })
    throw error
  }
  return {
    filename,
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

export function readCatalogMirror(
  store: OpenedCatalogStore,
  filename: string,
  override?: string,
): Uint8Array {
  const path = catalogMirrorPath(store, filename, override)
  try {
    return new Uint8Array(readFileSync(path))
  } catch {
    throw new CatalogError('Mirror zip not found', 404)
  }
}

export function putCatalogAssetBytes(
  store: OpenedCatalogStore,
  input: {
    filename: string
    mime: string
    bytes: Uint8Array
    id?: string
  },
  override?: string,
): CatalogAsset {
  const filename = input.filename.trim() || 'asset'
  if (filename.length > CATALOG_ASSET_FILENAME_MAX || filename.includes('/') || filename.includes('..')) {
    throw new CatalogError('Asset filename is not allowed', 400)
  }
  if (input.bytes.length === 0) {
    throw new CatalogError('Asset file is required', 400)
  }
  if (input.bytes.length > CATALOG_ASSET_BYTES_MAX) {
    throw new CatalogError('Asset is too large', 400)
  }
  const mime = input.mime.trim() || 'application/octet-stream'
  const id = input.id ?? randomUUID()
  const createdAt = Date.now()
  store.sqlite.prepare(`
    INSERT INTO catalog_assets (id, filename, mime, byte_size, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, filename, mime, input.bytes.length, createdAt)
  const dir = catalogAssetsDir(store, override)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, id), input.bytes)
  const saved = getCatalogAsset(store, id)
  if (!saved) {
    throw new CatalogError('Could not store the asset', 500)
  }
  return saved
}

export function getCatalogAsset(store: OpenedCatalogStore, id: string): CatalogAsset | undefined {
  const row = asAssetRecord(store.sqlite.prepare(`
    SELECT id, filename, mime, byte_size, created_at
    FROM catalog_assets
    WHERE id = ?
  `).get(id))
  return row ? toCatalogAsset(row) : undefined
}

export function readCatalogAssetBytes(
  store: OpenedCatalogStore,
  id: string,
  override?: string,
): Uint8Array {
  const asset = getCatalogAsset(store, id)
  if (!asset) {
    throw new CatalogError('Asset not found', 404)
  }
  try {
    return new Uint8Array(readFileSync(join(catalogAssetsDir(store, override), asset.id)))
  } catch {
    throw new CatalogError('Asset not found', 404)
  }
}

export function catalogAssetPublicPath(id: string): string {
  return `/api/catalog/assets/${id}`
}
