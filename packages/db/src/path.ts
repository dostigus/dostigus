export const DEFAULT_STORE_URL = 'file:.data/cluster.sqlite'
export const COMPOSE_STORE_URL = 'file:/var/lib/dostigus/cluster.sqlite'

export function storeFilePath(databaseUrl: string): string {
  const trimmed = databaseUrl.trim()
  if (trimmed === ':memory:' || trimmed === 'file::memory:') {
    return ':memory:'
  }
  return trimmed.startsWith('file:') ? trimmed.slice('file:'.length) : trimmed
}
