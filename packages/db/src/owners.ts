import type { Owner } from '@dostigus/shared'
import type { OwnerRecord } from './map'
import type { OpenedStore } from './store'
import { randomUUID } from 'node:crypto'
import {
  looksLikeEmail,
  normalizeOwnerEmail,
  normalizeOwnerUsername,
  parseOwnerIdentifier,
} from '@dostigus/shared'
import { toOwner } from './map'
import { StoreError } from './queries'

export type OwnerSecret = Owner & {
  passwordHash: string
}

function nowMs(): number {
  return Date.now()
}

function asOwnerRecord(row: unknown): OwnerRecord | undefined {
  if (!row || typeof row !== 'object') {
    return undefined
  }
  const value = row as OwnerRecord
  if (typeof value.id !== 'string' || typeof value.password_hash !== 'string') {
    return undefined
  }
  return value
}

export function countOwners(store: OpenedStore): number {
  const row = store.sqlite.prepare('SELECT count(*) AS n FROM owners').get() as { n: number }
  return row.n
}

export function ownerExists(store: OpenedStore): boolean {
  return countOwners(store) > 0
}

export function getOwner(store: OpenedStore, id: string): Owner | undefined {
  const row = asOwnerRecord(store.sqlite.prepare(`
    SELECT id, email, username, password_hash, created_at
    FROM owners
    WHERE id = ?
  `).get(id))
  return row ? toOwner(row) : undefined
}

export function findOwnerSecretByLogin(store: OpenedStore, login: string): OwnerSecret | undefined {
  const trimmed = login.trim()
  if (!trimmed) {
    return undefined
  }
  const row = looksLikeEmail(trimmed)
    ? asOwnerRecord(store.sqlite.prepare(`
        SELECT id, email, username, password_hash, created_at
        FROM owners
        WHERE email = ?
      `).get(normalizeOwnerEmail(trimmed) ?? trimmed))
    : asOwnerRecord(store.sqlite.prepare(`
        SELECT id, email, username, password_hash, created_at
        FROM owners
        WHERE username = ?
      `).get(normalizeOwnerUsername(trimmed) ?? trimmed))
  if (!row) {
    return undefined
  }
  return {
    ...toOwner(row),
    passwordHash: row.password_hash,
  }
}

export function createOwner(
  store: OpenedStore,
  input: { email?: string | null, username?: string | null, passwordHash: string },
): Owner {
  if (ownerExists(store)) {
    throw new StoreError('This Cluster already has an Owner', 409)
  }

  let email: string | null = null
  let username: string | null = null
  try {
    if (input.email) {
      email = parseOwnerIdentifier(input.email).email
    }
    if (input.username) {
      username = parseOwnerIdentifier(input.username).username
    }
  } catch (error) {
    throw new StoreError(error instanceof Error ? error.message : 'Invalid email or username', 400)
  }
  if (!email && !username) {
    throw new StoreError('Email or username is required', 400)
  }

  const hash = input.passwordHash.trim()
  if (!hash) {
    throw new StoreError('Password hash is required', 400)
  }

  const id = randomUUID()
  const createdAt = nowMs()
  try {
    store.sqlite.prepare(`
      INSERT INTO owners (id, email, username, password_hash, created_at, singleton)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(id, email, username, hash, createdAt)
  } catch (error) {
    if (ownerExists(store)) {
      throw new StoreError('This Cluster already has an Owner', 409)
    }
    throw error
  }

  const created = getOwner(store, id)
  if (!created) {
    throw new StoreError('Could not create the Owner', 500)
  }
  return created
}
