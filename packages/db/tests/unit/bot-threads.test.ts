import type { DatabaseSync } from 'node:sqlite'
import { DatabaseSync as Sqlite } from 'node:sqlite'
import { botThreadPersonId } from '@dostigus/shared'
import { expect, it } from 'vitest'
import {
  createBot,
  createMember,
  createOwner,
  disableMember,
  insertMessage,
  listBots,
  listBotThreadMessages,
  listMessages,
  listThreadMessages,
  openStore,
  searchMessages,
  setBotVisibility,
  STORE_MIGRATIONS,
  StoreError,
} from '../../src/index'

function memoryStore() {
  const store = openStore('file::memory:')
  return store
}

function applyBeforeVisibility(sqlite: DatabaseSync) {
  for (const migration of STORE_MIGRATIONS) {
    if (migration.id === '0011_bot_visibility_threads') {
      return
    }
    sqlite.exec(migration.sql)
  }
}

function visibilityMigrationSql(): string {
  const migration = STORE_MIGRATIONS.find((item) => item.id === '0011_bot_visibility_threads')
  if (!migration) {
    throw new Error('missing 0011_bot_visibility_threads')
  }
  return migration.sql
}

it('places existing messages onto one bot-thread per person', () => {
  const sqlite = new Sqlite(':memory:')
  applyBeforeVisibility(sqlite)
  const store = { sqlite, close: () => sqlite.close() }
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  sqlite.prepare(`
    INSERT INTO bots (
      id, name, model_tier, avatar_shape, avatar_color, label, description,
      skills_json, modules_json, created_at
    ) VALUES ('notes', 'Notes', 'strong', 'goose', '#1F7AE5', '', '', '[]', '[]', 1000)
  `).run()
  const insert = sqlite.prepare(`
    INSERT INTO messages (id, bot_id, role, content, created_at, person_id, parts_json)
    VALUES (?, 'notes', ?, ?, ?, ?, '[]')
  `)
  insert.run('g', 'assistant', 'hello', 1000, null)
  insert.run('u-owner', 'user', 'owner line', 2000, owner.id)
  insert.run('a-owner', 'assistant', 'owner reply', 3000, null)
  insert.run('u-member', 'user', 'member line', 4000, member.id)
  insert.run('a-member', 'assistant', 'member reply', 5000, null)
  insert.run('sys', 'system', 'after member', 6000, null)
  insert.run('u-blank', 'user', 'no person', 7000, null)

  sqlite.prepare(`
    INSERT INTO bots (
      id, name, model_tier, avatar_shape, avatar_color, label, description,
      skills_json, modules_json, created_at
    ) VALUES ('solo', 'Solo', 'strong', 'goose', '#1F7AE5', '', '', '[]', '[]', 1500)
  `).run()
  sqlite.prepare(`
    INSERT INTO messages (id, bot_id, role, content, created_at, person_id, parts_json)
    VALUES ('solo-g', 'solo', 'assistant', 'leading', 1500, NULL, '[]')
  `).run()

  // Same timestamp: id order decides which user row is nearest.
  sqlite.prepare(`
    INSERT INTO bots (
      id, name, model_tier, avatar_shape, avatar_color, label, description,
      skills_json, modules_json, created_at
    ) VALUES ('tie', 'Tie', 'strong', 'goose', '#1F7AE5', '', '', '[]', '[]', 1600)
  `).run()
  sqlite.prepare(`
    INSERT INTO messages (id, bot_id, role, content, created_at, person_id, parts_json)
    VALUES ('b-assist', 'tie', 'assistant', 'after user', 1800, NULL, '[]')
  `).run()
  sqlite.prepare(`
    INSERT INTO messages (id, bot_id, role, content, created_at, person_id, parts_json)
    VALUES ('a-user', 'tie', 'user', 'first by id', 1800, ?, '[]')
  `).run(member.id)

  sqlite.exec(visibilityMigrationSql())

  const placed = sqlite.prepare(`
    SELECT id, thread_id FROM messages ORDER BY id
  `).all() as Array<{ id: string, thread_id: string | null }>
  const byId = Object.fromEntries(placed.map((row) => [row.id, row.thread_id]))
  const ownerThread = `bt:notes:${owner.id}`
  const memberThread = `bt:notes:${member.id}`
  expect(byId.g).toBe(ownerThread)
  expect(byId['u-owner']).toBe(ownerThread)
  expect(byId['a-owner']).toBe(ownerThread)
  expect(byId['u-member']).toBe(memberThread)
  expect(byId['a-member']).toBe(memberThread)
  expect(byId.sys).toBe(memberThread)
  expect(byId['u-blank']).toBe(memberThread)
  expect(byId['solo-g']).toBe(`bt:solo:${owner.id}`)
  expect(byId['a-user']).toBe(`bt:tie:${member.id}`)
  expect(byId['b-assist']).toBe(`bt:tie:${member.id}`)
  expect(placed.every((row) => row.thread_id)).toBe(true)

  const participants = sqlite.prepare(`
    SELECT thread_id, kind, ref_id FROM thread_participants ORDER BY thread_id, kind
  `).all() as Array<{ thread_id: string, kind: string, ref_id: string }>
  expect(participants).toEqual(expect.arrayContaining([
    { thread_id: ownerThread, kind: 'person', ref_id: owner.id },
    { thread_id: ownerThread, kind: 'bot', ref_id: 'notes' },
    { thread_id: memberThread, kind: 'person', ref_id: member.id },
    { thread_id: memberThread, kind: 'bot', ref_id: 'notes' },
  ]))

  const createdBy = sqlite.prepare(`SELECT id, visibility, created_by FROM bots ORDER BY id`).all()
  expect(createdBy).toEqual([
    { id: 'notes', visibility: 'shared', created_by: owner.id },
    { id: 'solo', visibility: 'shared', created_by: owner.id },
    { id: 'tie', visibility: 'shared', created_by: owner.id },
  ])

  const before = placed.map((row) => row.thread_id)
  const cutoverAt = visibilityMigrationSql().indexOf('DROP TABLE IF EXISTS `_bot_thread_place`')
  sqlite.exec(visibilityMigrationSql().slice(cutoverAt))
  const after = (sqlite.prepare('SELECT thread_id FROM messages ORDER BY id').all() as Array<{ thread_id: string }>)
    .map((row) => row.thread_id)
  expect(after).toEqual(before)
  sqlite.close()
})

it('keeps each person on their own bot-thread and lets the Owner open a private one', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const other = createMember(store, {
    displayName: 'Lin',
    username: 'lin',
    passwordHash: 'hash:lin',
  })
  const shared = createBot(store, { name: 'Shared', createdBy: owner.id, visibility: 'shared' }).bot
  expect(shared.visibility).toBe('shared')
  expect(shared.createdBy).toBe(owner.id)
  const priv = createBot(store, {
    name: 'Shelf',
    visibility: 'private',
    createdBy: member.id,
  }).bot
  expect(priv.visibility).toBe('private')
  expect(priv.createdBy).toBe(member.id)

  insertMessage(store, {
    botId: shared.id,
    role: 'user',
    content: 'owner only',
    personId: owner.id,
    viewer: { id: owner.id, role: 'owner' },
  })
  insertMessage(store, {
    botId: shared.id,
    role: 'assistant',
    content: 'owner reply',
    viewer: { id: owner.id, role: 'owner' },
  })
  insertMessage(store, {
    botId: shared.id,
    role: 'user',
    content: 'member only',
    personId: member.id,
    viewer: { id: member.id, role: 'member' },
  })
  insertMessage(store, {
    botId: priv.id,
    role: 'user',
    content: 'private line',
    personId: member.id,
    viewer: { id: member.id, role: 'member' },
  })

  const ownerThread = listBotThreadMessages(store, shared.id, owner.id).map((line) => line.content)
  const memberThread = listBotThreadMessages(store, shared.id, member.id).map((line) => line.content)
  expect(ownerThread).toContain('owner only')
  expect(ownerThread).toContain('owner reply')
  expect(ownerThread).not.toContain('member only')
  expect(memberThread).toContain('member only')
  expect(memberThread).not.toContain('owner only')
  expect(listMessages(store, shared.id).length).toBeGreaterThan(ownerThread.length)

  const ownerView = { id: owner.id, role: 'owner' as const }
  const memberView = { id: member.id, role: 'member' as const }
  const otherView = { id: other.id, role: 'member' as const }
  expect(listBots(store, ownerView).map((bot) => bot.id).sort()).toEqual([priv.id, shared.id].sort())
  expect(listBots(store, memberView).map((bot) => bot.id).sort()).toEqual([priv.id, shared.id].sort())
  expect(listBots(store, otherView).map((bot) => bot.id)).toEqual([shared.id])

  const opened = listBotThreadMessages(store, priv.id, botThreadPersonId(priv, ownerView))
  expect(opened.map((line) => line.content)).toContain('private line')
  const ownerOpen = listBotThreadMessages(store, priv.id, owner.id)
  expect(ownerOpen.map((line) => line.content)).toContain('private line')
  const threadCount = store.sqlite.prepare(`
    SELECT count(*) AS n FROM threads WHERE bot_id = ?
  `).get(priv.id) as { n: number }
  expect(threadCount.n).toBe(1)

  expect(searchMessages(store, 'only', 8, memberView).map((hit) => hit.content)).toEqual(['member only'])
  expect(searchMessages(store, 'private line', 8, ownerView)).toHaveLength(1)
  expect(searchMessages(store, 'private line', 8, otherView)).toEqual([])

  const flipped = setBotVisibility(store, priv.id, 'shared')
  expect(flipped.visibility).toBe('shared')
  expect(flipped.createdBy).toBe(member.id)
  setBotVisibility(store, priv.id, 'private')
  expect(setBotVisibility(store, priv.id, 'private').createdBy).toBe(member.id)

  disableMember(store, member.id)
  expect(listBots(store, ownerView).some((bot) => bot.id === priv.id)).toBe(true)

  expect(() => insertMessage(store, {
    botId: priv.id,
    role: 'user',
    content: 'nope',
    personId: other.id,
    viewer: otherView,
  })).toThrow(StoreError)

  store.close()
})

it('gives a new person their own greeting on a shared Bot', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  const { bot } = createBot(store, { name: 'Notes', createdBy: owner.id })
  const first = listBotThreadMessages(store, bot.id, member.id)
  expect(first).toHaveLength(1)
  expect(first[0]?.role).toBe('assistant')
  expect(listThreadMessages(store, `bt:${bot.id}:${owner.id}`)).toHaveLength(1)
  expect(listBotThreadMessages(store, bot.id, member.id)).toHaveLength(1)
  store.close()
})
