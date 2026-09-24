import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export const DEFAULT_STORE_URL = 'file:.data/cluster.sqlite'
export const COMPOSE_STORE_URL = 'file:/var/lib/dostigus/cluster.sqlite'

export function storeFilePath(databaseUrl: string): string {
  const trimmed = databaseUrl.trim()
  if (trimmed === ':memory:' || trimmed === 'file::memory:') {
    return ':memory:'
  }
  return trimmed.startsWith('file:') ? trimmed.slice('file:'.length) : trimmed
}

/**
 * Artifact bytes sit next to the Store file: `.data/artifacts/<uuid>` locally
 * and `/var/lib/dostigus/artifacts/<uuid>` on compose. See ADR 0034.
 */
export function artifactsDirFromStoreUrl(databaseUrl: string): string {
  const file = storeFilePath(databaseUrl)
  if (file === ':memory:') {
    return join(tmpdir(), 'dostigus-artifacts-memory')
  }
  return join(dirname(file), 'artifacts')
}
