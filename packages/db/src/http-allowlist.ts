import type { OpenedStore } from './store'
import { isIP } from 'node:net'
import { StoreError } from './store-error'

/** Same singleton row as Cluster timezone. See ADR 0027 and ADR 0031. */
const CLUSTER_SETTINGS_ID = 'cluster'

const HOSTNAME_MAX = 253
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function parseHttpAllowlistHost(value: unknown): string {
  if (typeof value !== 'string') {
    throw new StoreError('HTTP allowlist entries are hostnames', 400)
  }
  const raw = value.trim()
  if (!raw) {
    throw new StoreError('HTTP allowlist entries are hostnames', 400)
  }
  if (
    /^https?:\/\//i.test(raw)
    || raw.includes('/')
    || raw.includes('?')
    || raw.includes('#')
    || raw.includes('@')
    || raw.includes('*')
  ) {
    throw new StoreError('HTTP allowlist entries are hostnames only', 400)
  }
  let host = raw.toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1)
  }
  host = host.replace(/\.$/, '')
  if (isIP(host)) {
    return host
  }
  if (host.includes(':') || host.length > HOSTNAME_MAX) {
    throw new StoreError('HTTP allowlist entries are hostnames only', 400)
  }
  const labels = host.split('.')
  if (labels.some((label) => !DNS_LABEL.test(label))) {
    throw new StoreError('HTTP allowlist entries are hostnames only', 400)
  }
  return host
}

export function parseHttpAllowlistJson(raw: string | null | undefined): string[] {
  if (raw == null || !raw.trim()) {
    return []
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new StoreError('Cluster http allowlist is invalid', 500)
  }
  if (!Array.isArray(parsed)) {
    throw new StoreError('Cluster http allowlist is invalid', 500)
  }
  return parsed.map((entry) => parseHttpAllowlistHost(entry))
}

export function normalizeHttpAllowlist(hosts: unknown): string[] {
  if (hosts == null) {
    return []
  }
  if (!Array.isArray(hosts)) {
    throw new StoreError('Cluster http allowlist must be an array of hostnames', 400)
  }
  const seen = new Set<string>()
  const next: string[] = []
  for (const entry of hosts) {
    const host = parseHttpAllowlistHost(entry)
    if (!seen.has(host)) {
      seen.add(host)
      next.push(host)
    }
  }
  return next
}

/** Empty allowlist allows every public host. Match is exact, case-insensitive. */
export function httpAllowlistAllows(hostname: string, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) {
    return true
  }
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  return allowlist.includes(host)
}

function readAllowlistRow(store: OpenedStore): { http_allowlist: string | null } | undefined {
  return store.sqlite.prepare(`
    SELECT http_allowlist FROM cluster_settings WHERE id = ?
  `).get(CLUSTER_SETTINGS_ID) as { http_allowlist: string | null } | undefined
}

export function getClusterHttpAllowlist(store: OpenedStore): string[] {
  return parseHttpAllowlistJson(readAllowlistRow(store)?.http_allowlist)
}

export function setClusterHttpAllowlist(store: OpenedStore, hosts: unknown): string[] {
  const next = normalizeHttpAllowlist(hosts)
  const now = Date.now()
  store.sqlite.prepare(`
    INSERT INTO cluster_settings (id, http_allowlist, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      http_allowlist = excluded.http_allowlist,
      updated_at = excluded.updated_at
  `).run(CLUSTER_SETTINGS_ID, JSON.stringify(next), now)
  return getClusterHttpAllowlist(store)
}
