import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { upgradeClusterMetaSkills } from './meta-skills'
import { applyStoreMigrations } from './migrations'
import { DEFAULT_STORE_URL, storeFilePath } from './path'

export type OpenedStore = {
  sqlite: DatabaseSync
  close: () => void
}

export function openStore(databaseUrl: string = DEFAULT_STORE_URL): OpenedStore {
  const path = storeFilePath(databaseUrl)
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const sqlite = new DatabaseSync(path, {
    enableForeignKeyConstraints: true,
  })
  sqlite.exec('PRAGMA journal_mode = WAL;')
  applyStoreMigrations(sqlite)

  let closed = false
  const opened: OpenedStore = {
    sqlite,
    close: () => {
      if (closed) {
        return
      }
      closed = true
      sqlite.close()
    },
  }
  // Image upgrade, not Apply. A Bot that already has any meta Skill id
  // is left alone. See ADR 0030.
  upgradeClusterMetaSkills(opened)
  return opened
}
