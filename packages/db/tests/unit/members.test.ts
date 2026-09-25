import { expect, it } from 'vitest'
import {
  authorNameForPerson,
  createBot,
  createMember,
  createOwner,
  disableMember,
  findMemberSecretByLogin,
  insertMessage,
  listMembers,
  listMessages,
  openStore,
  seedMemberLocale,
  StoreError,
  updateMemberLocale,
} from '../../src/index'

function memoryStore() {
  const store = openStore('file::memory:')
  createOwner(store, { username: 'owner.nick', passwordHash: 'hash:owner' })
  return store
}

it('adds a Member and rejects a login the Owner already uses', () => {
  const store = memoryStore()
  const member = createMember(store, {
    displayName: 'Ada',
    username: 'ada',
    passwordHash: 'hash:ada',
  })
  expect(member.displayName).toBe('Ada')
  expect(member.username).toBe('ada')
  expect(member.disabledAt).toBeNull()
  expect(member.locale).toBeNull()
  expect(listMembers(store)).toHaveLength(1)

  expect(() => createMember(store, {
    displayName: 'Nick',
    username: 'owner.nick',
    passwordHash: 'hash:x',
  })).toThrow(StoreError)
  try {
    createMember(store, {
      displayName: 'Nick',
      username: 'owner.nick',
      passwordHash: 'hash:x',
    })
  } catch (error) {
    expect((error as StoreError).statusCode).toBe(409)
    expect((error as StoreError).message).toMatch(/already on this Host/)
  }
  store.close()
})

it('turns off sign-in and keeps the display name on Chat', () => {
  const store = memoryStore()
  const member = createMember(store, {
    displayName: 'Ada Lovelace',
    email: 'ada@example.test',
    passwordHash: 'hash:ada',
  })
  const bot = createBot(store, { name: 'Notes' }).bot
  const message = insertMessage(store, {
    botId: bot.id,
    role: 'user',
    content: 'Hello',
    personId: member.id,
  })
  expect(message.personId).toBe(member.id)

  const disabled = disableMember(store, member.id)
  expect(disabled.disabledAt).toBeTruthy()
  expect(disableMember(store, member.id).displayName).toBe('Ada Lovelace')
  expect(authorNameForPerson(store, member.id)).toBe('Ada Lovelace')
  expect(listMessages(store, bot.id).find((line) => line.role === 'user')?.personId).toBe(member.id)
  expect(findMemberSecretByLogin(store, 'ada@example.test')?.disabledAt).toBeTruthy()
  store.close()
})

it('seeds Member.locale from the cookie only while it is still null', () => {
  const store = memoryStore()
  const member = createMember(store, {
    displayName: 'Ada',
    username: 'ada',
    passwordHash: 'hash:ada',
  })
  expect(member.locale).toBeNull()
  expect(seedMemberLocale(store, member.id, 'nope').locale).toBeNull()
  expect(seedMemberLocale(store, member.id, 'ru').locale).toBe('ru')
  expect(seedMemberLocale(store, member.id, 'en').locale).toBe('ru')
  expect(updateMemberLocale(store, member.id, 'en').locale).toBe('en')
  expect(() => updateMemberLocale(store, member.id, 'de')).toThrow(StoreError)
  store.close()
})

it('shows the Owner login as the author name', () => {
  const store = memoryStore()
  const ownerName = authorNameForPerson(store, findOwnerId(store))
  expect(ownerName).toBe('owner.nick')
  expect(authorNameForPerson(store, null)).toBeNull()
  store.close()
})

function findOwnerId(store: ReturnType<typeof memoryStore>): string {
  const row = store.sqlite.prepare('SELECT id FROM owners').get() as { id: string }
  return row.id
}
