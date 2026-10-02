import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { applyCatalogStoreMigrations } from './migrations'
import {
  catalogAssetsDirFromStoreUrl,
  catalogMirrorsDirFromStoreUrl,
  catalogStoreFilePath,
  DEFAULT_CATALOG_STORE_URL,
} from './path'

export type OpenedCatalogStore = {
  sqlite: DatabaseSync
  databaseUrl: string
  mirrorsDir: string
  assetsDir: string
  close: () => void
}

export function openCatalogStore(
  databaseUrl: string = DEFAULT_CATALOG_STORE_URL,
): OpenedCatalogStore {
  const path = catalogStoreFilePath(databaseUrl)
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const sqlite = new DatabaseSync(path, {
    enableForeignKeyConstraints: true,
  })
  sqlite.exec('PRAGMA journal_mode = WAL;')
  applyCatalogStoreMigrations(sqlite)

  let closed = false
  return {
    sqlite,
    databaseUrl,
    mirrorsDir: catalogMirrorsDirFromStoreUrl(databaseUrl),
    assetsDir: catalogAssetsDirFromStoreUrl(databaseUrl),
    close: () => {
      if (closed) {
        return
      }
      closed = true
      sqlite.close()
    },
  }
}
