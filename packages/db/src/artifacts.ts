import type { Artifact, ArtifactStatus } from '@dostigus/shared'
import type { ArtifactRecord } from './map'
import type { OpenedStore } from './store'
import { randomUUID } from 'node:crypto'
import { ARTIFACT_PARTIAL_TTL_MS, ARTIFACT_PENDING_TTL_MS, ARTIFACTS_PER_MESSAGE_MAX } from '@dostigus/shared'
import { toArtifact } from './map'
import { StoreError } from './store-error'

const ARTIFACT_SELECT = `
  id, filename, mime, byte_size, content_hash, actor_person_id,
  created_at, upload_id, status, last_joined_at
`

function nowMs(): number {
  return Date.now()
}

function asArtifactRecord(row: unknown): ArtifactRecord | undefined {
  if (!row || typeof row !== 'object') {
    return undefined
  }
  const value = row as ArtifactRecord
  if (typeof value.id !== 'string' || typeof value.content_hash !== 'string') {
    return undefined
  }
  return value
}

export function getArtifact(store: OpenedStore, id: string): ArtifactRecord | undefined {
  return asArtifactRecord(store.sqlite.prepare(`
    SELECT ${ARTIFACT_SELECT}
    FROM artifacts
    WHERE id = ?
  `).get(id))
}

export function getCompleteArtifact(store: OpenedStore, id: string): ArtifactRecord | undefined {
  const row = getArtifact(store, id)
  if (!row || row.status !== 'complete') {
    return undefined
  }
  return row
}

export function findArtifactByUpload(store: OpenedStore, uploadId: string, contentHash: string): ArtifactRecord | undefined {
  return asArtifactRecord(store.sqlite.prepare(`
    SELECT ${ARTIFACT_SELECT}
    FROM artifacts
    WHERE upload_id = ? AND content_hash = ? AND status = 'complete'
    ORDER BY created_at ASC
    LIMIT 1
  `).get(uploadId, contentHash))
}

export function sumArtifactBytes(store: OpenedStore): number {
  const row = store.sqlite.prepare(`
    SELECT COALESCE(SUM(byte_size), 0) AS n FROM artifacts
  `).get() as { n: number }
  return Number(row.n) || 0
}

export function insertArtifactRow(
  store: OpenedStore,
  input: {
    id?: string
    filename: string
    mime: string
    byteSize: number
    contentHash: string
    actorPersonId: string
    uploadId?: string | null
    status?: ArtifactStatus
    createdAt?: number
  },
): ArtifactRecord {
  const id = input.id ?? randomUUID()
  const createdAt = input.createdAt ?? nowMs()
  const status = input.status ?? 'complete'
  const uploadId = input.uploadId?.trim() || null
  store.sqlite.prepare(`
    INSERT INTO artifacts (
      id, filename, mime, byte_size, content_hash, actor_person_id,
      created_at, upload_id, status, last_joined_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    id,
    input.filename,
    input.mime,
    input.byteSize,
    input.contentHash,
    input.actorPersonId,
    createdAt,
    uploadId,
    status,
  )
  const row = getArtifact(store, id)
  if (!row) {
    throw new StoreError('Could not store the Artifact', 500)
  }
  return row
}

export function markArtifactComplete(store: OpenedStore, id: string): ArtifactRecord {
  store.sqlite.prepare(`
    UPDATE artifacts SET status = 'complete' WHERE id = ?
  `).run(id)
  const row = getArtifact(store, id)
  if (!row) {
    throw new StoreError('Artifact not found', 404)
  }
  return row
}

export function artifactJoinCount(store: OpenedStore, artifactId: string): number {
  const row = store.sqlite.prepare(`
    SELECT count(*) AS n FROM message_artifacts WHERE artifact_id = ?
  `).get(artifactId) as { n: number }
  return Number(row.n) || 0
}

function hasMessageArtifactsTable(store: OpenedStore): boolean {
  const row = store.sqlite.prepare(`
    SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'message_artifacts'
  `).get() as { ok: number } | undefined
  return Boolean(row)
}

export function listArtifactsForMessages(store: OpenedStore, messageIds: string[]): Map<string, Artifact[]> {
  const map = new Map<string, Artifact[]>()
  if (messageIds.length === 0 || !hasMessageArtifactsTable(store)) {
    return map
  }
  const placeholders = messageIds.map(() => '?').join(', ')
  const rows = store.sqlite.prepare(`
    SELECT
      message_artifacts.message_id AS message_id,
      artifacts.id AS id,
      artifacts.filename AS filename,
      artifacts.mime AS mime,
      artifacts.byte_size AS byte_size,
      artifacts.content_hash AS content_hash,
      artifacts.actor_person_id AS actor_person_id,
      artifacts.created_at AS created_at,
      artifacts.upload_id AS upload_id,
      artifacts.status AS status,
      artifacts.last_joined_at AS last_joined_at
    FROM message_artifacts
    INNER JOIN artifacts ON artifacts.id = message_artifacts.artifact_id
    WHERE message_artifacts.message_id IN (${placeholders})
    ORDER BY message_artifacts.created_at ASC, artifacts.rowid ASC
  `).all(...messageIds) as Array<ArtifactRecord & { message_id: string }>
  for (const row of rows) {
    const list = map.get(row.message_id) ?? []
    list.push(toArtifact(row))
    map.set(row.message_id, list)
  }
  return map
}

export function attachArtifactsToMessages<T extends { id: string, artifacts?: Artifact[] }>(
  store: OpenedStore,
  messages: T[],
): T[] {
  const byMessage = listArtifactsForMessages(store, messages.map((message) => message.id))
  return messages.map((message) => ({
    ...message,
    artifacts: byMessage.get(message.id) ?? [],
  }))
}

export function joinMessageArtifacts(
  store: OpenedStore,
  messageId: string,
  artifactIds: string[],
): Artifact[] {
  const unique = [...new Set(artifactIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) {
    return []
  }
  if (unique.length > ARTIFACTS_PER_MESSAGE_MAX) {
    throw new StoreError(`A message may join at most ${ARTIFACTS_PER_MESSAGE_MAX} Artifacts`, 400)
  }
  const existing = store.sqlite.prepare(`
    SELECT count(*) AS n FROM message_artifacts WHERE message_id = ?
  `).get(messageId) as { n: number }
  if ((Number(existing.n) || 0) + unique.length > ARTIFACTS_PER_MESSAGE_MAX) {
    throw new StoreError(`A message may join at most ${ARTIFACTS_PER_MESSAGE_MAX} Artifacts`, 400)
  }
  const joinedAt = nowMs()
  for (const artifactId of unique) {
    const row = getCompleteArtifact(store, artifactId)
    if (!row) {
      throw new StoreError('Artifact not found', 404)
    }
    store.sqlite.prepare(`
      INSERT OR IGNORE INTO message_artifacts (message_id, artifact_id, created_at)
      VALUES (?, ?, ?)
    `).run(messageId, artifactId, joinedAt)
    if (row.last_joined_at == null) {
      store.sqlite.prepare(`
        UPDATE artifacts SET last_joined_at = ? WHERE id = ? AND last_joined_at IS NULL
      `).run(joinedAt, artifactId)
    }
  }
  return listArtifactsForMessages(store, [messageId]).get(messageId) ?? []
}

export function assertAttachableArtifacts(
  store: OpenedStore,
  artifactIds: string[],
  actorPersonId: string,
): void {
  const unique = [...new Set(artifactIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length > ARTIFACTS_PER_MESSAGE_MAX) {
    throw new StoreError(`A message may join at most ${ARTIFACTS_PER_MESSAGE_MAX} Artifacts`, 400)
  }
  for (const artifactId of unique) {
    const row = getCompleteArtifact(store, artifactId)
    if (!row) {
      throw new StoreError('Artifact not found', 404)
    }
    if (row.actor_person_id !== actorPersonId) {
      throw new StoreError('Artifact not found', 404)
    }
  }
}

export function personMayReadArtifact(
  store: OpenedStore,
  artifactId: string,
  threadIds: string[],
): boolean {
  if (threadIds.length === 0) {
    return false
  }
  const placeholders = threadIds.map(() => '?').join(', ')
  const row = store.sqlite.prepare(`
    SELECT 1 AS ok
    FROM message_artifacts
    INNER JOIN messages ON messages.id = message_artifacts.message_id
    WHERE message_artifacts.artifact_id = ?
      AND messages.thread_id IN (${placeholders})
    LIMIT 1
  `).get(artifactId, ...threadIds) as { ok: number } | undefined
  return Boolean(row)
}

export function listOrphanArtifactIds(store: OpenedStore): string[] {
  const rows = store.sqlite.prepare(`
    SELECT artifacts.id AS id
    FROM artifacts
    WHERE artifacts.last_joined_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM message_artifacts WHERE message_artifacts.artifact_id = artifacts.id
      )
  `).all() as { id: string }[]
  return rows.map((row) => row.id)
}

export function listPendingArtifactIds(store: OpenedStore, now: number): string[] {
  const cutoff = now - ARTIFACT_PENDING_TTL_MS
  const rows = store.sqlite.prepare(`
    SELECT id FROM artifacts
    WHERE status = 'complete'
      AND last_joined_at IS NULL
      AND created_at <= ?
  `).all(cutoff) as { id: string }[]
  return rows.map((row) => row.id)
}

export function listPartialArtifactIds(store: OpenedStore, now: number): string[] {
  const cutoff = now - ARTIFACT_PARTIAL_TTL_MS
  const rows = store.sqlite.prepare(`
    SELECT id FROM artifacts
    WHERE status = 'partial' AND created_at <= ?
  `).all(cutoff) as { id: string }[]
  return rows.map((row) => row.id)
}

export function deleteArtifactRows(store: OpenedStore, ids: string[]): string[] {
  const deleted: string[] = []
  for (const id of ids) {
    const result = store.sqlite.prepare('DELETE FROM artifacts WHERE id = ?').run(id)
    if (Number(result.changes) > 0) {
      deleted.push(id)
    }
  }
  return deleted
}

export function artifactIdsJoinedToBot(store: OpenedStore, botId: string): string[] {
  const rows = store.sqlite.prepare(`
    SELECT DISTINCT message_artifacts.artifact_id AS id
    FROM message_artifacts
    INNER JOIN messages ON messages.id = message_artifacts.message_id
    WHERE messages.bot_id = ? OR messages.thread_id IN (
      SELECT id FROM threads WHERE bot_id = ?
    )
  `).all(botId, botId) as { id: string }[]
  return rows.map((row) => row.id)
}

export function toPublicArtifact(row: ArtifactRecord): Artifact {
  return toArtifact(row)
}
