import type { Invite } from '@dostigus/shared'
import type { InviteRecord } from './map'
import type { OpenedStore } from './store'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { INVITE_TTL_MS, parseInviteEmail, parseMemberDisplayName } from '@dostigus/shared'
import { toInvite } from './map'
import { createMember } from './members'
import { getOwner } from './owners'
import { StoreError } from './queries'

const INVALID_INVITE = 'This link is invalid'

const INVITE_COLUMNS = `id, token_hash, email, expires_at, created_by, created_at, used_at, revoked_at`

export type IssuedInvite = {
  invite: Invite
  token: string
}

function nowMs(): number {
  return Date.now()
}

function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function asInviteRecord(row: unknown): InviteRecord | undefined {
  if (!row || typeof row !== 'object') {
    return undefined
  }
  const value = row as InviteRecord
  if (typeof value.id !== 'string' || typeof value.token_hash !== 'string' || typeof value.email !== 'string') {
    return undefined
  }
  return value
}

function changesOf(result: unknown): number {
  if (!result || typeof result !== 'object' || !('changes' in result)) {
    return 0
  }
  const changes = (result as { changes: unknown }).changes
  return typeof changes === 'number' ? changes : Number(changes)
}

function withImmediate<T>(store: OpenedStore, fn: () => T): T {
  store.sqlite.exec('BEGIN IMMEDIATE')
  try {
    const value = fn()
    store.sqlite.exec('COMMIT')
    return value
  } catch (error) {
    store.sqlite.exec('ROLLBACK')
    throw error
  }
}

function emailReserved(store: OpenedStore, email: string): boolean {
  const owner = store.sqlite.prepare('SELECT id FROM owners WHERE email = ?').get(email)
  const member = store.sqlite.prepare('SELECT id FROM members WHERE email = ?').get(email)
  return Boolean(owner || member)
}

function inviteById(store: OpenedStore, id: string): InviteRecord | undefined {
  return asInviteRecord(store.sqlite.prepare(`
    SELECT ${INVITE_COLUMNS}
    FROM invites
    WHERE id = ?
  `).get(id))
}

function inviteByHash(store: OpenedStore, tokenHash: string): InviteRecord | undefined {
  return asInviteRecord(store.sqlite.prepare(`
    SELECT ${INVITE_COLUMNS}
    FROM invites
    WHERE token_hash = ?
  `).get(tokenHash))
}

function requireInvite(store: OpenedStore, id: string): Invite {
  const row = inviteById(store, id)
  if (!row) {
    throw new StoreError('Could not save the Invite', 500)
  }
  return toInvite(row)
}

/** Still open: not used, not revoked, and inside the TTL. */
function isAcceptable(row: InviteRecord, now: number): boolean {
  return row.used_at == null && row.revoked_at == null && row.expires_at > now
}

function parseEmailOrThrow(email: string): string {
  try {
    return parseInviteEmail(email)
  } catch (error) {
    throw new StoreError(error instanceof Error ? error.message : 'Enter a valid email', 400)
  }
}

export function listPendingInvites(store: OpenedStore): Invite[] {
  const rows = store.sqlite.prepare(`
    SELECT ${INVITE_COLUMNS}
    FROM invites
    WHERE used_at IS NULL AND revoked_at IS NULL
    ORDER BY created_at DESC
  `).all()
  return rows.map((row) => toInvite(asInviteRecord(row)!))
}

export function issueInvite(
  store: OpenedStore,
  input: { email: string, createdBy: string },
): IssuedInvite {
  const email = parseEmailOrThrow(input.email)
  if (!getOwner(store, input.createdBy)) {
    throw new StoreError('This Host needs an Owner first', 409)
  }
  if (emailReserved(store, email)) {
    throw new StoreError('That email is already on this Host', 409)
  }

  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashInviteToken(token)
  const now = nowMs()
  const id = randomUUID()
  const expiresAt = now + INVITE_TTL_MS

  withImmediate(store, () => {
    if (emailReserved(store, email)) {
      throw new StoreError('That email is already on this Host', 409)
    }
    store.sqlite.prepare(`
      UPDATE invites
      SET revoked_at = ?
      WHERE email = ? AND used_at IS NULL AND revoked_at IS NULL
    `).run(now, email)
    store.sqlite.prepare(`
      INSERT INTO invites (
        id, token_hash, email, expires_at, created_by, created_at, used_at, revoked_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
    `).run(id, tokenHash, email, expiresAt, input.createdBy, now)
  })

  return {
    invite: requireInvite(store, id),
    token,
  }
}

export function revokeInvite(store: OpenedStore, id: string): Invite {
  const current = inviteById(store, id)
  if (!current) {
    throw new StoreError('Invite not found', 404)
  }
  if (current.used_at != null) {
    throw new StoreError('This invite was already used', 409)
  }
  if (current.revoked_at == null) {
    store.sqlite.prepare(`
      UPDATE invites
      SET revoked_at = ?
      WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL
    `).run(nowMs(), id)
  }
  const updated = inviteById(store, id)
  if (!updated) {
    throw new StoreError('Invite not found', 404)
  }
  return toInvite(updated)
}

export function rotateInvite(store: OpenedStore, id: string, createdBy: string): IssuedInvite {
  const current = inviteById(store, id)
  if (!current) {
    throw new StoreError('Invite not found', 404)
  }
  if (current.used_at != null) {
    throw new StoreError('This invite was already used', 409)
  }
  if (current.revoked_at != null) {
    throw new StoreError('This invite was revoked', 409)
  }
  return issueInvite(store, { email: current.email, createdBy })
}

/** Manual Add Member retires a still-open Invite for that email. */
export function revokeOutstandingInvitesForEmail(store: OpenedStore, email: string): void {
  let normalized: string
  try {
    normalized = parseInviteEmail(email)
  } catch {
    return
  }
  store.sqlite.prepare(`
    UPDATE invites
    SET revoked_at = ?
    WHERE email = ? AND used_at IS NULL AND revoked_at IS NULL
  `).run(nowMs(), normalized)
}

export function acceptInvite(
  store: OpenedStore,
  input: { token: string, displayName: string, passwordHash: string },
) {
  const token = input.token.trim()
  if (!token) {
    throw new StoreError(INVALID_INVITE, 404)
  }
  let displayName: string
  try {
    displayName = parseMemberDisplayName(input.displayName)
  } catch (error) {
    throw new StoreError(error instanceof Error ? error.message : 'Check the Member details', 400)
  }
  const passwordHash = input.passwordHash.trim()
  if (!passwordHash) {
    throw new StoreError('Password hash is required', 400)
  }

  const tokenHash = hashInviteToken(token)
  const now = nowMs()

  return withImmediate(store, () => {
    const row = inviteByHash(store, tokenHash)
    if (!row || !isAcceptable(row, now)) {
      throw new StoreError(INVALID_INVITE, 404)
    }
    if (emailReserved(store, row.email)) {
      throw new StoreError('That email is already on this Host', 409)
    }
    const member = createMember(store, {
      displayName,
      email: row.email,
      passwordHash,
    })
    const updated = store.sqlite.prepare(`
      UPDATE invites
      SET used_at = ?
      WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?
    `).run(now, row.id, now)
    if (changesOf(updated) !== 1) {
      throw new StoreError(INVALID_INVITE, 404)
    }
    return member
  })
}

/** Email shown on the accept form. Missing, used, revoked, and expired are the same error. */
export function readAcceptableInvite(store: OpenedStore, token: string): { email: string, expiresAt: string } {
  const trimmed = token.trim()
  if (!trimmed) {
    throw new StoreError(INVALID_INVITE, 404)
  }
  const row = inviteByHash(store, hashInviteToken(trimmed))
  if (!row || !isAcceptable(row, nowMs())) {
    throw new StoreError(INVALID_INVITE, 404)
  }
  return {
    email: row.email,
    expiresAt: new Date(row.expires_at).toISOString(),
  }
}
