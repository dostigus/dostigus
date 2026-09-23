import { createOwner, openStore } from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import { addHouseholdMember } from '../../server/utils/household'
import {
  acceptHouseholdInvite,
  createHouseholdInvite,
  inviteOrigin,
  listHouseholdInvites,
  revokeHouseholdInvite,
  rotateHouseholdInvite,
} from '../../server/utils/household-invites'
import { loginHostAccount, OwnerAuthError } from '../../server/utils/owner-auth'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  const owner = createOwner(store, { email: 'owner@example.test', passwordHash: 'hash:owner' })
  return { store, ownerId: owner.id }
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

it('uses https for a public host and the request scheme on loopback', () => {
  expect(inviteOrigin({ host: 'localhost:3000' })).toBe('http://localhost:3000')
  expect(inviteOrigin({
    host: '127.0.0.1:3000',
    forwardedProto: 'https',
  })).toBe('https://127.0.0.1:3000')
  expect(inviteOrigin({
    host: 'localhost:3000',
    forwardedHost: 'dostigus.example, evil.test',
  })).toBe('https://dostigus.example')
  expect(inviteOrigin({ host: 'household.example:8443' })).toBe('https://household.example:8443')
  expect(() => inviteOrigin({ host: 'bad host' })).toThrow(OwnerAuthError)
  expect(() => inviteOrigin({ forwardedHost: 'https://evil.test' })).toThrow(OwnerAuthError)
})

it('returns the Invite URL once, rotates it, and signs the new Member in', async () => {
  const { store, ownerId } = memoryStore()
  const created = createHouseholdInvite(
    store,
    { email: 'Ada@Example.test' },
    ownerId,
    'https://dostigus.example',
  )
  expect(created.url.startsWith('https://dostigus.example/invite/')).toBe(true)
  expect(created).not.toHaveProperty('token')
  const firstToken = created.url.slice('https://dostigus.example/invite/'.length)
  expect(JSON.stringify(listHouseholdInvites(store))).not.toContain(firstToken)

  const rotated = rotateHouseholdInvite(store, created.invite.id, ownerId, 'https://dostigus.example')
  expect(rotated.url).not.toBe(created.url)
  expect(listHouseholdInvites(store)).toHaveLength(1)
  expect(listHouseholdInvites(store)[0]?.id).toBe(rotated.invite.id)

  await expect(acceptHouseholdInvite(store, firstToken, {
    displayName: 'Ada',
    password: 'secret-pass',
  }, hashPassword)).rejects.toMatchObject({ statusCode: 404 })

  const token = rotated.url.slice('https://dostigus.example/invite/'.length)
  const member = await acceptHouseholdInvite(store, token, {
    displayName: 'Ada',
    password: 'secret-pass',
  }, hashPassword)
  expect(member.email).toBe('ada@example.test')
  expect(member.displayName).toBe('Ada')

  const session = await loginHostAccount(store, {
    login: 'ada@example.test',
    password: 'secret-pass',
  }, verifyPassword)
  expect(session.role).toBe('member')
  expect(session.id).toBe(member.id)
  expect(listHouseholdInvites(store)).toEqual([])
})

it('rejects a short password and does not write a Member', async () => {
  const { store, ownerId } = memoryStore()
  const created = createHouseholdInvite(
    store,
    { email: 'ada@example.test' },
    ownerId,
    'https://dostigus.example',
  )
  const token = created.url.slice('https://dostigus.example/invite/'.length)
  await expect(acceptHouseholdInvite(store, token, {
    displayName: 'Ada',
    password: 'short',
  }, hashPassword)).rejects.toBeInstanceOf(OwnerAuthError)
  expect(listHouseholdInvites(store)).toHaveLength(1)
})

it('revokes a pending Invite when that email is added by hand', async () => {
  const { store, ownerId } = memoryStore()
  const created = createHouseholdInvite(
    store,
    { email: 'ada@example.test' },
    ownerId,
    'http://localhost:3000',
  )
  const token = created.url.slice('http://localhost:3000/invite/'.length)
  await addHouseholdMember(store, {
    displayName: 'Ada',
    login: 'ada@example.test',
    password: 'secret-pass',
  }, hashPassword)
  expect(listHouseholdInvites(store)).toEqual([])
  await expect(acceptHouseholdInvite(store, token, {
    displayName: 'Other',
    password: 'secret-pass',
  }, hashPassword)).rejects.toMatchObject({
    statusCode: 404,
    message: 'This link is invalid',
  })
})

it('lets the Owner revoke a pending Invite', () => {
  const { store, ownerId } = memoryStore()
  const created = createHouseholdInvite(
    store,
    { email: 'ada@example.test' },
    ownerId,
    'https://dostigus.example',
  )
  const revoked = revokeHouseholdInvite(store, created.invite.id)
  expect(revoked.revokedAt).toBeTruthy()
  expect(listHouseholdInvites(store)).toEqual([])
})
