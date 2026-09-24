import type { Member } from '@dostigus/shared'
import type { MemberRecord } from './map'
import type { OpenedStore } from './store'
import { randomUUID } from 'node:crypto'
import {
  ownerDisplayName,
  parseMemberDisplayName,
  parseOwnerIdentifier,
} from '@dostigus/shared'
import { toMember } from './map'
import { getOwner, ownerExists } from './owners'
import { StoreError } from './store-error'

export type MemberSecret = Member & {
  passwordHash: string
}

function nowMs(): number {
  return Date.now()
}

function asMemberRecord(row: unknown): MemberRecord | undefined {
  if (!row || typeof row !== 'object') {
    return undefined
  }
  const value = row as MemberRecord
  if (typeof value.id !== 'string' || typeof value.password_hash !== 'string') {
    return undefined
  }
  return value
}

const MEMBER_COLUMNS = `id, display_name, email, username, password_hash, created_at, disabled_at`

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false
  }
  return (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
}

function loginTaken(store: OpenedStore, email: string | null, username: string | null): boolean {
  if (email) {
    const owner = store.sqlite.prepare('SELECT id FROM owners WHERE email = ?').get(email)
    const member = store.sqlite.prepare('SELECT id FROM members WHERE email = ?').get(email)
    if (owner || member) {
      return true
    }
  }
  if (username) {
    const owner = store.sqlite.prepare('SELECT id FROM owners WHERE username = ?').get(username)
    const member = store.sqlite.prepare('SELECT id FROM members WHERE username = ?').get(username)
    if (owner || member) {
      return true
    }
  }
  return false
}

export function listMembers(store: OpenedStore): Member[] {
  const rows = store.sqlite.prepare(`
    SELECT ${MEMBER_COLUMNS}
    FROM members
    ORDER BY created_at ASC
  `).all()
  return rows.map((row) => toMember(asMemberRecord(row)!))
}

export function getMember(store: OpenedStore, id: string): Member | undefined {
  const row = asMemberRecord(store.sqlite.prepare(`
    SELECT ${MEMBER_COLUMNS}
    FROM members
    WHERE id = ?
  `).get(id))
  return row ? toMember(row) : undefined
}

export function findMemberSecretByLogin(store: OpenedStore, login: string): MemberSecret | undefined {
  const trimmed = login.trim()
  if (!trimmed) {
    return undefined
  }
  let email: string | null = null
  let username: string | null = null
  try {
    const parsed = parseOwnerIdentifier(trimmed)
    email = parsed.email
    username = parsed.username
  } catch {
    return undefined
  }
  const row = email
    ? asMemberRecord(store.sqlite.prepare(`
        SELECT ${MEMBER_COLUMNS}
        FROM members
        WHERE email = ?
      `).get(email))
    : asMemberRecord(store.sqlite.prepare(`
        SELECT ${MEMBER_COLUMNS}
        FROM members
        WHERE username = ?
      `).get(username))
  if (!row) {
    return undefined
  }
  return {
    ...toMember(row),
    passwordHash: row.password_hash,
  }
}

export function createMember(
  store: OpenedStore,
  input: {
    displayName: string
    email?: string | null
    username?: string | null
    passwordHash: string
  },
): Member {
  if (!ownerExists(store)) {
    throw new StoreError('This Host needs an Owner first', 409)
  }

  let displayName: string
  let email: string | null = null
  let username: string | null = null
  try {
    displayName = parseMemberDisplayName(input.displayName)
    if (input.email) {
      email = parseOwnerIdentifier(input.email).email
    }
    if (input.username) {
      username = parseOwnerIdentifier(input.username).username
    }
  } catch (error) {
    throw new StoreError(error instanceof Error ? error.message : 'Check the Member details', 400)
  }
  if (!email && !username) {
    throw new StoreError('Email or username is required', 400)
  }

  const hash = input.passwordHash.trim()
  if (!hash) {
    throw new StoreError('Password hash is required', 400)
  }
  if (loginTaken(store, email, username)) {
    throw new StoreError('That email or username is already on this Host', 409)
  }

  const id = randomUUID()
  const createdAt = nowMs()
  try {
    store.sqlite.prepare(`
      INSERT INTO members (
        id, display_name, email, username, password_hash, created_at, disabled_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `).run(id, displayName, email, username, hash, createdAt)
  } catch (error) {
    if (isUniqueViolation(error) || loginTaken(store, email, username)) {
      throw new StoreError('That email or username is already on this Host', 409)
    }
    throw error
  }

  const created = getMember(store, id)
  if (!created) {
    throw new StoreError('Could not add the Member', 500)
  }
  return created
}

export function disableMember(store: OpenedStore, id: string): Member {
  const current = getMember(store, id)
  if (!current) {
    throw new StoreError('Member not found', 404)
  }
  if (!current.disabledAt) {
    store.sqlite.prepare(`
      UPDATE members
      SET disabled_at = ?
      WHERE id = ?
    `).run(nowMs(), id)
  }
  const updated = getMember(store, id)
  if (!updated) {
    throw new StoreError('Member not found', 404)
  }
  return updated
}

/** Display name for a Host user message. Empty when personId is unknown. */
export function authorNameForPerson(
  store: OpenedStore,
  personId: string | null | undefined,
): string | null {
  if (!personId) {
    return null
  }
  const member = getMember(store, personId)
  if (member) {
    return member.displayName
  }
  const owner = getOwner(store, personId)
  if (owner) {
    return ownerDisplayName(owner)
  }
  return null
}
