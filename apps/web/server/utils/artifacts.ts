import type { OpenedStore } from '@dostigus/db'
import type { Artifact, BotViewer } from '@dostigus/shared'
import type { HostHttpLookup } from './http-get'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { createReadStream, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { realpath } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import process from 'node:process'
import {
  artifactsDirFromStoreUrl,
  assertAttachableArtifacts,
  DEFAULT_STORE_URL,
  deleteArtifactRows,
  findArtifactByUpload,
  getClusterHttpAllowlist,
  getClusterOwnerId,
  getCompleteArtifact,
  insertArtifactRow,
  joinMessageArtifacts,
  listAccessibleThreadIds,
  listOrphanArtifactIds,
  listPartialArtifactIds,
  listPendingArtifactIds,
  markArtifactComplete,
  personMayReadArtifact,
  StoreError,
  sumArtifactBytes,
  toPublicArtifact,
} from '@dostigus/db'
import {
  ARTIFACT_CLUSTER_QUOTA_BYTES,
  ARTIFACT_PUT_BASE64_MAX_BYTES,
  ARTIFACT_UI_MAX_BYTES,
  ARTIFACTS_PER_MESSAGE_MAX,
  extractArtifactText,
  isImageArtifactMime,
  resolveArtifactMime,
  sanitizeArtifactFilename,
  withArtifactLlmContent,
} from '@dostigus/shared'
import { hostHttpGetBytes } from './http-get'

export { ARTIFACT_CLUSTER_QUOTA_BYTES, ARTIFACT_UI_MAX_BYTES }

function databaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_STORE_URL
}

export function clusterArtifactsDir(explicit?: string): string {
  return explicit?.trim() || artifactsDirFromStoreUrl(databaseUrl())
}

export function ensureArtifactsDir(dir: string): string {
  mkdirSync(dir, { recursive: true })
  return dir
}

export function artifactContentHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function assertArtifactQuota(store: OpenedStore, addBytes: number): void {
  const used = sumArtifactBytes(store)
  if (used + addBytes > ARTIFACT_CLUSTER_QUOTA_BYTES) {
    throw new StoreError('Cluster Artifact storage is full', 507)
  }
}

function writeArtifactBytes(dir: string, id: string, bytes: Uint8Array): void {
  ensureArtifactsDir(dir)
  const part = join(dir, `${id}.part`)
  const dest = join(dir, id)
  writeFileSync(part, bytes)
  renameSync(part, dest)
}

export async function jailedArtifactPath(dir: string, id: string): Promise<string> {
  if (!/^[\w-]{1,64}$/.test(id)) {
    throw new StoreError('Artifact not found', 404)
  }
  const root = await realpath(ensureArtifactsDir(dir))
  const target = resolve(root, id)
  let resolved: string
  try {
    resolved = await realpath(target)
  } catch {
    throw new StoreError('Artifact not found', 404)
  }
  if (resolved !== join(root, id) && !resolved.startsWith(root + sep)) {
    throw new StoreError('Artifact not found', 404)
  }
  if (dirname(resolved) !== root) {
    throw new StoreError('Artifact not found', 404)
  }
  return resolved
}

export function putArtifactBytes(
  store: OpenedStore,
  input: {
    bytes: Uint8Array
    filename?: string
    mime?: string | null
    actorPersonId: string
    uploadId?: string | null
    claimedHash?: string | null
    maxBytes?: number
    dir?: string
  },
): Artifact {
  const maxBytes = input.maxBytes ?? ARTIFACT_UI_MAX_BYTES
  if (input.bytes.byteLength === 0) {
    throw new StoreError('Artifact file is required', 400)
  }
  if (input.bytes.byteLength > maxBytes) {
    throw new StoreError(`Artifact must be ${maxBytes} bytes or fewer`, 400)
  }
  const hash = artifactContentHash(input.bytes)
  if (input.claimedHash && input.claimedHash.trim() && input.claimedHash.trim() !== hash) {
    throw new StoreError('Artifact hash does not match the file', 400)
  }
  const uploadId = input.uploadId?.trim() || null
  if (uploadId) {
    const existing = findArtifactByUpload(store, uploadId, hash)
    if (existing) {
      return toPublicArtifact(existing)
    }
  }
  let mime: string
  try {
    mime = resolveArtifactMime(input.bytes, input.mime)
  } catch (error) {
    throw new StoreError(error instanceof Error ? error.message : 'Artifact type is not allowed', 400)
  }
  assertArtifactQuota(store, input.bytes.byteLength)
  const filename = sanitizeArtifactFilename(input.filename)
  const row = insertArtifactRow(store, {
    filename,
    mime,
    byteSize: input.bytes.byteLength,
    contentHash: hash,
    actorPersonId: input.actorPersonId,
    uploadId,
    status: 'partial',
  })
  try {
    writeArtifactBytes(clusterArtifactsDir(input.dir), row.id, input.bytes)
    return toPublicArtifact(markArtifactComplete(store, row.id))
  } catch (error) {
    deleteArtifactRows(store, [row.id])
    throw error
  }
}

export async function putArtifactFromSourceUrl(
  store: OpenedStore,
  input: {
    sourceUrl: unknown
    filename?: string
    mime?: string | null
    actorPersonId: string
    dir?: string
    fetchImpl?: typeof fetch
    lookup?: HostHttpLookup
    env?: NodeJS.ProcessEnv
    maxBytes?: number
  },
): Promise<Artifact> {
  const fetched = await hostHttpGetBytes(input.sourceUrl, {
    allowlist: getClusterHttpAllowlist(store),
    fetchImpl: input.fetchImpl,
    lookup: input.lookup,
    env: input.env,
    maxBytes: input.maxBytes ?? ARTIFACT_UI_MAX_BYTES,
  })
  if (fetched.status < 200 || fetched.status >= 300) {
    throw new StoreError('Artifact sourceUrl could not be fetched', 400)
  }
  if (fetched.truncated) {
    throw new StoreError(`Artifact must be ${input.maxBytes ?? ARTIFACT_UI_MAX_BYTES} bytes or fewer`, 400)
  }
  return putArtifactBytes(store, {
    bytes: fetched.bytes,
    filename: input.filename,
    mime: input.mime,
    actorPersonId: input.actorPersonId,
    dir: input.dir,
    maxBytes: input.maxBytes ?? ARTIFACT_UI_MAX_BYTES,
  })
}

export function decodeArtifactBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string' || !value.trim()) {
    throw new StoreError('Artifact bytesBase64 is required', 400)
  }
  const trimmed = value.trim()
  const padded = trimmed.length % 4 === 0 ? trimmed : trimmed + '='.repeat(4 - (trimmed.length % 4))
  try {
    const buf = Buffer.from(padded, 'base64')
    if (buf.byteLength === 0) {
      throw new StoreError('Artifact bytesBase64 is required', 400)
    }
    if (buf.byteLength > ARTIFACT_PUT_BASE64_MAX_BYTES) {
      throw new StoreError(`Artifact bytesBase64 must be ${ARTIFACT_PUT_BASE64_MAX_BYTES} bytes or fewer`, 400)
    }
    return new Uint8Array(buf)
  } catch (error) {
    if (error instanceof StoreError) {
      throw error
    }
    throw new StoreError('Artifact bytesBase64 is invalid', 400)
  }
}

export async function putArtifactFromTool(
  store: OpenedStore,
  input: {
    filename?: unknown
    mime?: unknown
    bytesBase64?: unknown
    sourceUrl?: unknown
    actorPersonId: string
    dir?: string
    fetchImpl?: typeof fetch
    lookup?: HostHttpLookup
    env?: NodeJS.ProcessEnv
  },
): Promise<Artifact> {
  const filename = typeof input.filename === 'string' ? input.filename : ''
  const mime = typeof input.mime === 'string' ? input.mime : ''
  const hasBytes = typeof input.bytesBase64 === 'string' && input.bytesBase64.trim().length > 0
  const hasUrl = typeof input.sourceUrl === 'string' && input.sourceUrl.trim().length > 0
  if (hasBytes === hasUrl) {
    throw new StoreError('Give bytesBase64 or sourceUrl, not both', 400)
  }
  if (!filename.trim()) {
    throw new StoreError('Artifact filename is required', 400)
  }
  if (hasBytes) {
    return putArtifactBytes(store, {
      bytes: decodeArtifactBase64(input.bytesBase64),
      filename,
      mime,
      actorPersonId: input.actorPersonId,
      dir: input.dir,
      maxBytes: ARTIFACT_PUT_BASE64_MAX_BYTES,
    })
  }
  return putArtifactFromSourceUrl(store, {
    sourceUrl: input.sourceUrl,
    filename,
    mime,
    actorPersonId: input.actorPersonId,
    dir: input.dir,
    fetchImpl: input.fetchImpl,
    lookup: input.lookup,
    env: input.env,
    maxBytes: ARTIFACT_UI_MAX_BYTES,
  })
}

export function artifactActorForTurn(store: OpenedStore, input: {
  personId?: string
  wake?: boolean
}): string {
  if (input.wake) {
    const ownerId = getClusterOwnerId(store)
    if (!ownerId) {
      throw new StoreError('This Cluster needs an Owner', 400)
    }
    return ownerId
  }
  if (input.personId) {
    return input.personId
  }
  const ownerId = getClusterOwnerId(store)
  if (!ownerId) {
    throw new StoreError('This Cluster needs an Owner', 400)
  }
  return ownerId
}

export function attachUserArtifacts(
  store: OpenedStore,
  messageId: string,
  artifactIds: string[],
  actorPersonId: string,
): Artifact[] {
  if (artifactIds.length === 0) {
    return []
  }
  assertAttachableArtifacts(store, artifactIds, actorPersonId)
  return joinMessageArtifacts(store, messageId, artifactIds)
}

export function attachTurnArtifacts(
  store: OpenedStore,
  messageId: string,
  artifactIds: string[],
): Artifact[] {
  if (artifactIds.length === 0) {
    return []
  }
  return joinMessageArtifacts(store, messageId, artifactIds)
}

export function viewerMayReadArtifact(
  store: OpenedStore,
  artifactId: string,
  viewer: BotViewer,
): boolean {
  return personMayReadArtifact(store, artifactId, listAccessibleThreadIds(store, viewer))
}

export function requireReadableArtifact(
  store: OpenedStore,
  artifactId: string,
  viewer: BotViewer,
) {
  const row = getCompleteArtifact(store, artifactId)
  if (!row || !viewerMayReadArtifact(store, artifactId, viewer)) {
    throw new StoreError('Artifact not found', 404)
  }
  return row
}

export function contentDispositionFor(row: { filename: string, mime: string }, download: boolean): string {
  const safe = row.filename.replace(/["\r\n]/g, '_')
  const kind = download || !isImageArtifactMime(row.mime) ? 'attachment' : 'inline'
  return `${kind}; filename="${safe}"`
}

export async function openArtifactStream(
  store: OpenedStore,
  artifactId: string,
  viewer: BotViewer,
  options: { download?: boolean, dir?: string } = {},
) {
  const row = requireReadableArtifact(store, artifactId, viewer)
  const path = await jailedArtifactPath(clusterArtifactsDir(options.dir), row.id)
  const stat = statSync(path)
  return {
    row,
    path,
    size: stat.size,
    stream: createReadStream(path),
    download: options.download === true,
  }
}

function removeArtifactFiles(dir: string, ids: string[]): void {
  for (const id of ids) {
    for (const name of [id, `${id}.part`]) {
      try {
        rmSync(join(dir, name), { force: true })
      } catch {
        // Best-effort. The next GC pass retries.
      }
    }
  }
}

function listStalePartFiles(dir: string, now: number, maxAgeMs: number): string[] {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith('.part'))
      .filter((name) => {
        try {
          return now - statSync(join(dir, name)).mtimeMs >= maxAgeMs
        } catch {
          return false
        }
      })
      .map((name) => name.replace(/\.part$/, ''))
  } catch {
    return []
  }
}

export function gcArtifacts(
  store: OpenedStore,
  input: { now?: number, dir?: string, orphanIds?: string[] } = {},
): { deleted: string[] } {
  const now = input.now ?? Date.now()
  const dir = clusterArtifactsDir(input.dir)
  const ids = [
    ...listPartialArtifactIds(store, now),
    ...listPendingArtifactIds(store, now),
    ...listOrphanArtifactIds(store),
    ...(input.orphanIds ?? []),
  ]
  const unique = [...new Set(ids)]
  const deleted = deleteArtifactRows(store, unique)
  removeArtifactFiles(dir, [...deleted, ...listStalePartFiles(dir, now, 60 * 60 * 1000)])
  return { deleted }
}

export function gcOrphansAfterUnlink(store: OpenedStore, candidateIds: string[], dir?: string): string[] {
  const orphans = listOrphanArtifactIds(store).filter((id) => candidateIds.includes(id))
  if (orphans.length === 0) {
    return []
  }
  return gcArtifacts(store, { dir, orphanIds: orphans }).deleted
}

export function annotateHistoryWithArtifacts<T extends {
  id?: string
  content: string
  artifacts?: Artifact[]
}>(
  messages: T[],
  options: { dir?: string } = {},
): T[] {
  const trigger = messages.at(-1)
  return messages.map((message) => {
    const artifacts = message.artifacts ?? []
    if (artifacts.length === 0) {
      return message
    }
    const isTrigger = trigger != null && (
      (trigger.id && message.id && trigger.id === message.id)
      || trigger === message
    )
    let extract: string | null = null
    if (isTrigger) {
      extract = artifacts
        .map((artifact) => readArtifactExtract(options.dir, artifact.id, artifact.mime))
        .filter((part): part is string => Boolean(part && part.trim()))
        .join('\n\n') || null
    }
    return {
      ...message,
      content: withArtifactLlmContent(message.content, artifacts, extract),
    }
  })
}

export class ArtifactTurn {
  readonly ids: string[] = []

  note(id: string): void {
    if (this.ids.includes(id)) {
      return
    }
    if (this.ids.length >= ARTIFACTS_PER_MESSAGE_MAX) {
      return
    }
    this.ids.push(id)
  }
}

export function readArtifactExtract(dir: string | undefined, id: string, mime: string): string | null {
  try {
    const path = join(clusterArtifactsDir(dir), id)
    const bytes = new Uint8Array(readFileSync(path))
    return extractArtifactText(bytes, mime)
  } catch {
    return null
  }
}
