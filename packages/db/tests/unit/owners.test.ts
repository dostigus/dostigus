import { expect, it } from 'vitest'
import { countOwners, createOwner, findOwnerSecretByLogin, openStore, ownerExists, StoreError } from '../../src/index'

function memoryStore() {
  return openStore('file::memory:')
}

it('registers exactly one Owner and rejects a second', () => {
  const store = memoryStore()
  expect(ownerExists(store)).toBe(false)
  expect(countOwners(store)).toBe(0)

  const owner = createOwner(store, {
    email: 'nick@example.test',
    passwordHash: 'hash:secret',
  })
  expect(owner.email).toBe('nick@example.test')
  expect(owner.username).toBeNull()
  expect(ownerExists(store)).toBe(true)
  expect(countOwners(store)).toBe(1)

  expect(() => createOwner(store, {
    username: 'other',
    passwordHash: 'hash:other',
  })).toThrow(StoreError)
  try {
    createOwner(store, {
      username: 'other',
      passwordHash: 'hash:other',
    })
  } catch (error) {
    expect(error).toBeInstanceOf(StoreError)
    expect((error as StoreError).statusCode).toBe(409)
    expect((error as StoreError).message).toMatch(/already has an Owner/)
  }
  expect(countOwners(store)).toBe(1)
  store.close()
})

it('finds the Owner by email or username', () => {
  const store = memoryStore()
  createOwner(store, {
    username: 'Nick.Owner',
    passwordHash: 'hash:pass',
  })

  const byUser = findOwnerSecretByLogin(store, 'nick.owner')
  expect(byUser?.username).toBe('nick.owner')
  expect(byUser?.passwordHash).toBe('hash:pass')
  expect(findOwnerSecretByLogin(store, 'missing')).toBeUndefined()
  store.close()
})

it('requires an email or username', () => {
  const store = memoryStore()
  expect(() => createOwner(store, { passwordHash: 'hash:x' })).toThrow(/Email or username/)
  store.close()
})
