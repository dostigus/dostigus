import { INVITE_TTL_MS } from '@dostigus/shared'
import { expect, it } from 'vitest'
import {
  acceptInvite,
  createMember,
  createOwner,
  disableMember,
  issueInvite,
  listPendingInvites,
  openStore,
  readAcceptableInvite,
  revokeInvite,
  revokeOutstandingInvitesForEmail,
  rotateInvite,
  StoreError,
} from '../../src/index'

function memoryStore() {
  const store = openStore('file::memory:')
  const owner = createOwner(store, {
    email: 'owner@example.test',
    passwordHash: 'hash:owner',
  })
  return { store, ownerId: owner.id }
}

it('stores only a token hash and expires in 7 days', () => {
  const { store, ownerId } = memoryStore()
  const issued = issueInvite(store, {
    email: 'Ada@Example.test',
    createdBy: ownerId,
  })
  expect(issued.invite.email).toBe('ada@example.test')
  expect(issued.token.length).toBeGreaterThan(20)
  const rows = store.sqlite.prepare('SELECT * FROM invites').all() as Array<{ token_hash: string }>
  expect(JSON.stringify(rows)).not.toContain(issued.token)
  expect(rows[0]?.token_hash).toHaveLength(64)
  expect(rows[0]?.token_hash).not.toBe(issued.token)
  expect(Date.parse(issued.invite.expiresAt) - Date.parse(issued.invite.createdAt)).toBe(INVITE_TTL_MS)
  expect(readAcceptableInvite(store, issued.token).email).toBe('ada@example.test')
  store.close()
})

it('revokes the previous token when the same email is invited again', () => {
  const { store, ownerId } = memoryStore()
  const first = issueInvite(store, { email: 'ada@example.test', createdBy: ownerId })
  const second = issueInvite(store, { email: 'Ada@Example.test', createdBy: ownerId })
  expect(listPendingInvites(store).map((invite) => invite.id)).toEqual([second.invite.id])
  expect(() => readAcceptableInvite(store, first.token)).toThrow(StoreError)
  try {
    readAcceptableInvite(store, first.token)
  } catch (error) {
    expect((error as StoreError).statusCode).toBe(404)
    expect((error as StoreError).message).toBe('This link is invalid')
  }
  expect(readAcceptableInvite(store, second.token).email).toBe('ada@example.test')
  store.close()
})

it('refuses an Invite when the email is the Owner, a Member, or a disabled Member', () => {
  const { store, ownerId } = memoryStore()
  expect(() => issueInvite(store, { email: 'owner@example.test', createdBy: ownerId })).toThrow(StoreError)
  try {
    issueInvite(store, { email: 'owner@example.test', createdBy: ownerId })
  } catch (error) {
    expect((error as StoreError).statusCode).toBe(409)
  }

  const member = createMember(store, {
    displayName: 'Ada',
    email: 'ada@example.test',
    passwordHash: 'hash:ada',
  })
  expect(() => issueInvite(store, { email: 'ada@example.test', createdBy: ownerId })).toThrow(StoreError)
  disableMember(store, member.id)
  try {
    issueInvite(store, { email: 'ada@example.test', createdBy: ownerId })
  } catch (error) {
    expect((error as StoreError).statusCode).toBe(409)
    expect((error as StoreError).message).toMatch(/already on this Host/)
  }
  expect(listPendingInvites(store)).toEqual([])
  expect(() => issueInvite(store, { email: 'ada', createdBy: ownerId })).toThrow(/valid email/)
  store.close()
})

it('accepts once, then treats used, revoked, expired, and unknown tokens the same', () => {
  const { store, ownerId } = memoryStore()
  const issued = issueInvite(store, { email: 'ada@example.test', createdBy: ownerId })
  const member = acceptInvite(store, {
    token: issued.token,
    displayName: 'Ada Lovelace',
    passwordHash: 'hash:ada',
  })
  expect(member.displayName).toBe('Ada Lovelace')
  expect(member.email).toBe('ada@example.test')
  expect(member.username).toBeNull()
  expect(member.disabledAt).toBeNull()
  expect(listPendingInvites(store)).toEqual([])

  expect(() => acceptInvite(store, {
    token: issued.token,
    displayName: 'Ada',
    passwordHash: 'hash:ada',
  })).toThrow(/This link is invalid/)
  expect(() => rotateInvite(store, issued.invite.id, ownerId)).toThrow(/already used/)
  expect(() => readAcceptableInvite(store, 'not-a-real-token')).toThrow(/This link is invalid/)

  const open = issueInvite(store, { email: 'grace@example.test', createdBy: ownerId })
  revokeInvite(store, open.invite.id)
  expect(() => readAcceptableInvite(store, open.token)).toThrow(/This link is invalid/)
  expect(() => rotateInvite(store, open.invite.id, ownerId)).toThrow(/revoked/)
  expect(listPendingInvites(store)).toEqual([])

  const expiring = issueInvite(store, { email: 'grace@example.test', createdBy: ownerId })
  store.sqlite.prepare('UPDATE invites SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, expiring.invite.id)
  expect(() => acceptInvite(store, {
    token: expiring.token,
    displayName: 'Grace',
    passwordHash: 'hash:grace',
  })).toThrow(/This link is invalid/)
  expect(listPendingInvites(store).map((invite) => invite.id)).toEqual([expiring.invite.id])
  const rotated = rotateInvite(store, expiring.invite.id, ownerId)
  expect(readAcceptableInvite(store, rotated.token).email).toBe('grace@example.test')
  expect(() => readAcceptableInvite(store, expiring.token)).toThrow(/This link is invalid/)
  store.close()
})

it('retires an outstanding Invite when that email is added by hand', () => {
  const { store, ownerId } = memoryStore()
  const issued = issueInvite(store, { email: 'ada@example.test', createdBy: ownerId })
  revokeOutstandingInvitesForEmail(store, 'Ada@Example.test')
  expect(listPendingInvites(store)).toEqual([])
  expect(() => readAcceptableInvite(store, issued.token)).toThrow(/This link is invalid/)
  store.close()
})
