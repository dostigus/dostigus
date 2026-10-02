import type { OpenedCatalogStore } from '@dostigus/catalog'
import process from 'node:process'
import {
  CatalogError,
  DEFAULT_CATALOG_STORE_URL,
  openCatalogStore,
} from '@dostigus/catalog'
import { PackInputError } from '@dostigus/shared'

let opened: OpenedCatalogStore | undefined

export function useCatalogStore(): OpenedCatalogStore {
  if (!opened) {
    opened = openCatalogStore(process.env.CATALOG_DATABASE_URL ?? DEFAULT_CATALOG_STORE_URL)
  }
  return opened
}

export function closeCatalogStore(): void {
  opened?.close()
  opened = undefined
}

export function catalogMirrorsDirOverride(): string | undefined {
  return process.env.CATALOG_MIRROR_DIR?.trim() || undefined
}

export function catalogAssetsDirOverride(): string | undefined {
  return process.env.CATALOG_ASSETS_DIR?.trim() || undefined
}

export function throwCatalogError(error: unknown): never {
  if (error instanceof CatalogError || error instanceof PackInputError) {
    throw createError({
      statusCode: error.statusCode,
      statusMessage: error.message,
    })
  }
  throw error
}

export function withCatalogStore<T>(fn: (store: OpenedCatalogStore) => T): T {
  try {
    return fn(useCatalogStore())
  } catch (error) {
    throwCatalogError(error)
  }
}
