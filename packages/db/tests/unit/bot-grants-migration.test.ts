import type { DatabaseSync } from 'node:sqlite'
import { DatabaseSync as Sqlite } from 'node:sqlite'
import { expect, it } from 'vitest'
import {
  createBot,
  createMember,
  createOwner,
  disableMember,
  grantBot,
  grantBotToCurrentMembers,
  listBotGrants,
  listBots,
  openStore,
  STORE_MIGRATIONS,
} from '../../src/index'

function applyMemberLocale(sqlite: DatabaseSync) {
  const migration = STORE_MIGRATIONS.find((item) => item.id === '0022_member_locale')
  if (!migration) {
    throw new Error('missing 0022_member_locale')
  }
  sqlite.exec(migration.sql)
}

function applyBeforeGrants(sqlite: DatabaseSync) {
  for (const migration of STORE_MIGRATIONS) {
    if (migration.id === '0013_bot_grants') {
      applyMemberLocale(sqlite)
      return
    }
    sqlite.exec(migration.sql)
  }
}

it('turns former shared Bots into one grant per current Member and drops visibility', () => {
  const sqlite = new Sqlite(':memory:')
  applyBeforeGrants(sqlite)
  const store = { sqlite, close: () => sqlite.close() }
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const grace = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const lin = createMember(store, {
    displayName: 'Lin',
    username: 'lin',
    passwordHash: 'hash:lin',
  })
  const parked = createMember(store, {
    displayName: 'Parked',
    username: 'parked',
    passwordHash: 'hash:parked',
  })
  disableMember(store, parked.id)
  sqlite.prepare(`
    INSERT INTO bots (
      id, name, model_tier, avatar_shape, avatar_color, label, description,
      skills_json, modules_json, created_at, visibility, created_by
    ) VALUES
      ('house', 'House', 'strong', 'goose', '#1F7AE5', '', '', '[]', '[]', 1000, 'shared', ?),
      ('shelf', 'Shelf', 'strong', 'goose', '#1F7AE5', '', '', '[]', '[]', 2000, 'private', ?),
      ('notes', 'Notes', 'strong', 'goose', '#1F7AE5', '', '', '[]', '[]', 3000, 'shared', ?)
  `).run(owner.id, grace.id, grace.id)

  const migration = STORE_MIGRATIONS.find((item) => item.id === '0013_bot_grants')
  if (!migration) {
    throw new Error('missing 0013_bot_grants')
  }
  sqlite.exec(migration.sql)

  const columns = sqlite.prepare('PRAGMA table_info(bots)').all() as Array<{ name: string }>
  expect(columns.map((column) => column.name)).not.toContain('visibility')

  const grants = sqlite.prepare(`
    SELECT bot_id, person_id FROM bot_grants ORDER BY bot_id, person_id
  `).all() as Array<{ bot_id: string, person_id: string }>
  const people = (botId: string) => grants
    .filter((row) => row.bot_id === botId)
    .map((row) => row.person_id)
    .sort()
  expect(people('house')).toEqual([grace.id, lin.id, parked.id].sort())
  expect(people('shelf')).toEqual([])
  expect(people('notes')).toEqual([lin.id, parked.id].sort())
  sqlite.close()
})

it('grants current Members once and leaves a later Member out', () => {
  const store = openStore('file::memory:')
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const grace = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const parked = createMember(store, {
    displayName: 'Parked',
    username: 'parked',
    passwordHash: 'hash:parked',
  })
  disableMember(store, parked.id)
  const bot = createBot(store, { name: 'House', createdBy: owner.id }).bot
  expect(listBots(store, { id: grace.id, role: 'member' })).toEqual([])

  const granted = grantBotToCurrentMembers(store, bot.id)
  expect(granted.map((row) => row.personId)).toEqual([grace.id])

  const later = createMember(store, {
    displayName: 'Lin',
    username: 'lin',
    passwordHash: 'hash:lin',
  })
  expect(listBotGrants(store, bot.id).map((row) => row.personId)).toEqual([grace.id])
  expect(listBots(store, { id: later.id, role: 'member' })).toEqual([])
  expect(() => grantBot(store, bot.id, owner.id)).toThrow(/creator already has/)

  const shelf = createBot(store, { name: 'Shelf', createdBy: grace.id }).bot
  expect(() => grantBot(store, shelf.id, owner.id)).toThrow(/Owner already sees/)

  store.close()
})
