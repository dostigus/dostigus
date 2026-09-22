import { createOwner, openStore } from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import { addHouseholdMember, disableHouseholdMember, listHouseholdMembers } from '../../server/utils/household'
import { loginHostAccount, OwnerAuthError } from '../../server/utils/owner-auth'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  createOwner(store, { email: 'owner@example.test', passwordHash: 'hash:owner' })
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

it('lets the Owner add a Member who can sign in', async () => {
  const store = memoryStore()
  const member = await addHouseholdMember(store, {
    displayName: 'Ada',
    login: 'Ada',
    password: 'secret-pass',
  }, hashPassword)
  expect(member.displayName).toBe('Ada')
  expect(member.username).toBe('ada')
  expect(listHouseholdMembers(store)).toHaveLength(1)

  const session = await loginHostAccount(store, {
    login: 'ada',
    password: 'secret-pass',
  }, verifyPassword)
  expect(session.role).toBe('member')
  expect(session.displayName).toBe('Ada')
  expect(session.id).toBe(member.id)
})

it('refuses sign-in after the Owner turns it off and keeps the name', async () => {
  const store = memoryStore()
  const member = await addHouseholdMember(store, {
    displayName: 'Ada',
    login: 'ada@example.test',
    password: 'secret-pass',
  }, hashPassword)
  disableHouseholdMember(store, member.id)

  await expect(loginHostAccount(store, {
    login: 'ada@example.test',
    password: 'secret-pass',
  }, verifyPassword)).rejects.toMatchObject({
    name: 'OwnerAuthError',
    statusCode: 401,
  })
  expect(listHouseholdMembers(store)[0]?.displayName).toBe('Ada')
  expect(listHouseholdMembers(store)[0]?.disabledAt).toBeTruthy()
})

it('rejects a short password before writing a Member', async () => {
  const store = memoryStore()
  await expect(addHouseholdMember(store, {
    displayName: 'Ada',
    login: 'ada',
    password: 'short',
  }, hashPassword)).rejects.toBeInstanceOf(OwnerAuthError)
  expect(listHouseholdMembers(store)).toEqual([])
})
