import { expect, it } from 'vitest'
import { STORE_MIGRATIONS } from '../../src/index'
import { MEMBER_COLUMN_MIGRATION_IDS } from './apply-member-columns'

it('lists every later members ALTER so replay tests stay aligned with createMember', () => {
  const later = STORE_MIGRATIONS
    .filter((migration) => /ALTER TABLE\s+`members`/i.test(migration.sql))
    .map((migration) => migration.id)
  expect([...MEMBER_COLUMN_MIGRATION_IDS]).toEqual(later)
})
