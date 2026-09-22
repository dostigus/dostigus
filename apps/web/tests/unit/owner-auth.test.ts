import { createOwner, openStore, StoreError } from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import {
  assertOwnerSession,
  isOwnerSessionUser,
  loginHostAccount,
  OwnerAuthError,
  registerClusterOwner,
  toOwnerSession,
} from '../../server/utils/owner-auth'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

async function hashPassword(password: string) {
  return `hash:${password}`
}

async function verifyPassword(hash: string, password: string) {
  return hash === `hash:${password}`
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('registers the first Owner and refuses a second register', async () => {
  const store = memoryStore()
  const owner = await registerClusterOwner(store, {
    login: 'nick@example.test',
    password: 'secret-pass',
  }, hashPassword)
  expect(owner.email).toBe('nick@example.test')
  expect(toOwnerSession(owner)).toEqual({
    id: owner.id,
    email: 'nick@example.test',
    username: null,
    displayName: 'nick@example.test',
    role: 'owner',
  })

  await expect(registerClusterOwner(store, {
    login: 'other',
    password: 'another-pass',
  }, hashPassword)).rejects.toMatchObject({
    name: 'OwnerAuthError',
    statusCode: 409,
  })
})

it('logs in with email or username and rejects a bad password', async () => {
  const store = memoryStore()
  await registerClusterOwner(store, {
    login: 'owner.nick',
    password: 'secret-pass',
  }, hashPassword)

  const signedIn = await loginHostAccount(store, {
    login: 'Owner.Nick',
    password: 'secret-pass',
  }, verifyPassword)
  expect(signedIn.username).toBe('owner.nick')
  expect(signedIn.role).toBe('owner')
  expect(signedIn.displayName).toBe('owner.nick')

  await expect(loginHostAccount(store, {
    login: 'owner.nick',
    password: 'wrong-pass',
  }, verifyPassword)).rejects.toBeInstanceOf(OwnerAuthError)
  try {
    await loginHostAccount(store, {
      login: 'owner.nick',
      password: 'wrong-pass',
    }, verifyPassword)
  } catch (error) {
    expect(error).toBeInstanceOf(OwnerAuthError)
    expect((error as OwnerAuthError).statusCode).toBe(401)
  }
})

it('treats a Member session as not the Owner', () => {
  expect(isOwnerSessionUser({ id: 'member-1', role: 'member' })).toBe(false)
  expect(isOwnerSessionUser({ id: 'owner-1', role: 'owner' })).toBe(true)
  expect(isOwnerSessionUser({ id: 'owner-1' })).toBe(true)
  expect(isOwnerSessionUser(null)).toBe(false)
})

it('throws 401 when the Owner session is missing', () => {
  expect(() => assertOwnerSession(null)).toThrow(OwnerAuthError)
  try {
    assertOwnerSession({})
  } catch (error) {
    expect((error as OwnerAuthError).statusCode).toBe(401)
    expect((error as OwnerAuthError).message).toMatch(/Owner session required/)
  }
  expect(() => assertOwnerSession({ user: { id: 'owner-1' } })).not.toThrow()
})

it('clears a session payload on logout', async () => {
  const store = memoryStore()
  const owner = await registerClusterOwner(store, {
    login: 'nick',
    password: 'secret-pass',
  }, hashPassword)
  const session = { user: toOwnerSession(owner) }
  assertOwnerSession(session)
  const cleared = { user: undefined }
  expect(() => assertOwnerSession(cleared)).toThrow(OwnerAuthError)
})

it('still refuses a second Store insert after the first Owner exists', () => {
  const store = memoryStore()
  createOwner(store, { username: 'first', passwordHash: 'hash:a' })
  expect(() => createOwner(store, { username: 'second', passwordHash: 'hash:b' })).toThrow(StoreError)
})
