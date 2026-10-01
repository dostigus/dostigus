import type { DatabaseSync } from 'node:sqlite'
import { STORE_MIGRATIONS } from '../../src/index'

/**
 * Later `members` columns so today's `createMember` can INSERT after an early
 * migration-replay stop (`0011_bot_visibility_threads`,
 * `0012_messenger_threads`, `0013_bot_grants`). Add the next members-table
 * migration id here when that table gains a column.
 */
export const MEMBER_COLUMN_MIGRATION_IDS = [
  '0022_member_locale',
  '0027_member_role',
] as const

export function applyMemberColumns(sqlite: DatabaseSync): void {
  for (const id of MEMBER_COLUMN_MIGRATION_IDS) {
    const migration = STORE_MIGRATIONS.find((item) => item.id === id)
    if (!migration) {
      throw new Error(`missing ${id}`)
    }
    sqlite.exec(migration.sql)
  }
}
