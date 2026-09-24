import type { LookupAddress, LookupOptions } from 'node:dns'
import { lookup as dnsLookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import process from 'node:process'
import { httpAllowlistAllows, StoreError } from '@dostigus/db'
import {
  attachOutboundDispatcher,
  createOutboundDispatcher,
  resolveBotHttpOutboundProxy,
  undiciOutboundFetch,
} from './outbound-fetch'

/**
 * Abort a hung GET so it cannot stall a Chat or Wake turn.
 * 8s is well under the LLM gateway budget (30s) and under the ping timeout.
 */
export const HOST_HTTP_GET_TIMEOUT_MS = 8_000

/** ADR 0031 body cap. A longer body is truncated; size is not a tool error. */
export const HOST_HTTP_GET_BODY_MAX_BYTES = 65_536

/** Follow this many Location hops. Each hop re-runs scheme, allowlist, and SSRF. */
export const HOST_HTTP_GET_MAX_REDIRECTS = 5

const HOST_USER_AGENT = 'Dostigus-Host/1.0'

const blocked = new BlockList()
blocked.addSubnet('0.0.0.0', 8, 'ipv4')
blocked.addSubnet('10.0.0.0', 8, 'ipv4')
blocked.addSubnet('127.0.0.0', 8, 'ipv4')
blocked.addSubnet('169.254.0.0', 16, 'ipv4')
blocked.addSubnet('172.16.0.0', 12, 'ipv4')
blocked.addSubnet('192.168.0.0', 16, 'ipv4')
blocked.addAddress('::', 'ipv6')
blocked.addAddress('::1', 'ipv6')
blocked.addSubnet('fc00::', 7, 'ipv6')
blocked.addSubnet('fe80::', 10, 'ipv6')

export type HostHttpGetResult = {
  status: number
  body: string
  truncated: boolean
}

export type HostHttpLookup = (
  hostname: string,
  options: LookupOptions,
) => Promise<LookupAddress | LookupAddress[]>

export type HostHttpGetOptions = {
  allowlist?: readonly string[]
  fetchImpl?: typeof fetch
  lookup?: HostHttpLookup
  timeoutMs?: number
  now?: () => number
  /** Process env for Bot HTTP egress. Tests pass a bag. Production uses process.env. */
  env?: NodeJS.ProcessEnv
}

function mappedIpv4(address: string): string | null {
  const lower = address.toLowerCase()
  if (!lower.startsWith('::ffff:')) {
    return null
  }
  const rest = lower.slice('::ffff:'.length)
  if (isIP(rest) === 4) {
    return rest
  }
  const parts = rest.split(':')
  if (parts.length === 2 && parts.every((part) => /^[0-9a-f]{1,4}$/.test(part))) {
    const high = Number.parseInt(parts[0]!, 16)
    const low = Number.parseInt(parts[1]!, 16)
    return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`
  }
  return null
}

/** Loopback, private, link-local, and unspecified addresses. Fail closed. */
export function isBlockedIpAddress(address: string): boolean {
  const mapped = mappedIpv4(address)
  if (mapped) {
    return isBlockedIpAddress(mapped)
  }
  const family = isIP(address)
  if (family === 4) {
    return blocked.check(address, 'ipv4')
  }
  if (family === 6) {
    return blocked.check(address, 'ipv6')
  }
  return true
}

export function parseHostHttpGetUrl(value: unknown): URL {
  if (typeof value !== 'string' || !value.trim()) {
    throw new StoreError('Host HTTP get requires a url', 400)
  }
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    throw new StoreError('Host HTTP get url is invalid', 400)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new StoreError('Host HTTP get allows http and https only', 400)
  }
  if (!parsed.hostname) {
    throw new StoreError('Host HTTP get url is invalid', 400)
  }
  return parsed
}

async function resolveAddresses(
  hostname: string,
  lookupFn: HostHttpLookup,
): Promise<string[]> {
  if (isIP(hostname)) {
    return [hostname]
  }
  try {
    const result = await lookupFn(hostname, { all: true })
    const rows = Array.isArray(result) ? result : [result]
    return rows.map((row) => row.address)
  } catch {
    throw new StoreError('Host HTTP get could not resolve the host', 400)
  }
}

export async function assertHostHttpGetDestination(
  url: URL,
  allowlist: readonly string[],
  lookupFn: HostHttpLookup = dnsLookup,
): Promise<void> {
  if (!httpAllowlistAllows(url.hostname, allowlist)) {
    throw new StoreError('host is not on the Cluster http allowlist', 403)
  }
  const addresses = await resolveAddresses(url.hostname, lookupFn)
  if (addresses.length === 0 || addresses.some((address) => isBlockedIpAddress(address))) {
    throw new StoreError('blocked destination', 403)
  }
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400 && status !== 304
}

function concatBytes(chunks: Uint8Array[], total: number): Uint8Array {
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function readCappedBody(response: Response): Promise<{ body: string, truncated: boolean }> {
  const max = HOST_HTTP_GET_BODY_MAX_BYTES
  if (!response.body) {
    const raw = new Uint8Array(await response.arrayBuffer())
    const truncated = raw.byteLength > max
    return {
      body: new TextDecoder('utf-8').decode(truncated ? raw.subarray(0, max) : raw),
      truncated,
    }
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    if (!value) {
      continue
    }
    if (total + value.byteLength > max) {
      const slice = value.subarray(0, max - total)
      chunks.push(slice)
      total += slice.byteLength
      truncated = true
      await reader.cancel()
      break
    }
    chunks.push(value)
    total += value.byteLength
  }
  return {
    body: new TextDecoder('utf-8').decode(concatBytes(chunks, total)),
    truncated,
  }
}

/**
 * GET a public URL. Scheme, allowlist, and SSRF run on the first hop
 * and on every redirect. The Turn journal stores the tool name only.
 */
export async function hostHttpGet(
  urlValue: unknown,
  options: HostHttpGetOptions = {},
): Promise<HostHttpGetResult> {
  const allowlist = options.allowlist ?? []
  const env = options.env ?? process.env
  const proxy = resolveBotHttpOutboundProxy(env)
  if (proxy.kind === 'invalid') {
    throw new StoreError('Bot HTTP proxy URL is invalid', 400)
  }
  const fetchImpl = attachOutboundDispatcher(
    options.fetchImpl ?? undiciOutboundFetch,
    createOutboundDispatcher(proxy.kind === 'proxy' ? proxy.href : null),
  )
  const lookupFn = options.lookup ?? dnsLookup
  const timeoutMs = options.timeoutMs ?? HOST_HTTP_GET_TIMEOUT_MS
  const started = (options.now ?? Date.now)()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let current = parseHostHttpGetUrl(urlValue)
  try {
    for (let hop = 0; hop <= HOST_HTTP_GET_MAX_REDIRECTS; hop += 1) {
      const elapsed = (options.now ?? Date.now)() - started
      if (elapsed >= timeoutMs) {
        throw new StoreError('Host HTTP get timed out', 504)
      }
      await assertHostHttpGetDestination(current, allowlist, lookupFn)
      let response: Response
      try {
        response = await fetchImpl(current.href, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'User-Agent': HOST_USER_AGENT },
        })
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw new StoreError('Host HTTP get timed out', 504)
        }
        throw new StoreError('Host HTTP get failed', 502)
      }
      if (isRedirectStatus(response.status)) {
        const location = response.headers.get('location')
        if (!location) {
          const { body, truncated } = await readCappedBody(response)
          return { status: response.status, body, truncated }
        }
        if (hop === HOST_HTTP_GET_MAX_REDIRECTS) {
          throw new StoreError('Host HTTP get hit too many redirects', 400)
        }
        try {
          current = new URL(location, current)
        } catch {
          throw new StoreError('Host HTTP get url is invalid', 400)
        }
        if (current.protocol !== 'http:' && current.protocol !== 'https:') {
          throw new StoreError('Host HTTP get allows http and https only', 400)
        }
        continue
      }
      const { body, truncated } = await readCappedBody(response)
      return { status: response.status, body, truncated }
    }
    throw new StoreError('Host HTTP get hit too many redirects', 400)
  } finally {
    clearTimeout(timer)
  }
}
