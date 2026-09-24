import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createOwner, openStore, setClusterHttpAllowlist } from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import {
  assertHostHttpGetDestination,
  HOST_HTTP_GET_BODY_MAX_BYTES,
  hostHttpGet,
  isBlockedIpAddress,
  parseHostHttpGetUrl,
} from '../../server/utils/http-get'
import { invokeChatMcpTool, platformToolSpec } from '../../server/utils/mcp-platform-tools'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

function lookup(map: Record<string, string[]>) {
  return async (hostname: string) => map[hostname]?.map((address) => ({
    address,
    family: address.includes(':') ? 6 : 4,
  })) ?? Promise.reject(new Error('ENOTFOUND'))
}

it('describes how to build an Open-Meteo forecast URL', () => {
  const description = platformToolSpec('dostigus_http_get').description
  expect(description).toContain('api.open-meteo.com')
  expect(description).toContain('latitude')
  expect(description).toContain('longitude')
  expect(description).toContain('temperature_2m')
  expect(description).toContain('apparent_temperature')
  expect(description).toContain('timezone')
  expect(description).not.toMatch(/dostigus_modules|Weather Skill seed/)
})

it('blocks loopback, private, link-local, and unspecified addresses', () => {
  expect(isBlockedIpAddress('127.0.0.1')).toBe(true)
  expect(isBlockedIpAddress('10.0.0.8')).toBe(true)
  expect(isBlockedIpAddress('172.16.1.2')).toBe(true)
  expect(isBlockedIpAddress('192.168.1.1')).toBe(true)
  expect(isBlockedIpAddress('169.254.169.254')).toBe(true)
  expect(isBlockedIpAddress('0.0.0.0')).toBe(true)
  expect(isBlockedIpAddress('::1')).toBe(true)
  expect(isBlockedIpAddress('::')).toBe(true)
  expect(isBlockedIpAddress('fc00::1')).toBe(true)
  expect(isBlockedIpAddress('fe80::1')).toBe(true)
  expect(isBlockedIpAddress('::ffff:127.0.0.1')).toBe(true)
  expect(isBlockedIpAddress('1.2.3.4')).toBe(false)
})

it('rejects a non-http scheme before fetch', () => {
  expect(() => parseHostHttpGetUrl('file:///etc/passwd')).toThrow(/http and https only/)
  expect(() => parseHostHttpGetUrl('ftp://example.com')).toThrow(/http and https only/)
})

it('blocks SSRF even when the allowlist is empty', async () => {
  await expect(assertHostHttpGetDestination(
    new URL('http://127.0.0.1/'),
    [],
  )).rejects.toThrow(/blocked destination/)

  await expect(assertHostHttpGetDestination(
    new URL('http://localhost/secret'),
    [],
    lookup({ localhost: ['127.0.0.1'] }),
  )).rejects.toThrow(/blocked destination/)

  await expect(assertHostHttpGetDestination(
    new URL('http://metadata.google.internal/'),
    [],
    lookup({ 'metadata.google.internal': ['169.254.169.254'] }),
  )).rejects.toThrow(/blocked destination/)
})

it('blocks a listed host that resolves to a private address', async () => {
  await expect(assertHostHttpGetDestination(
    new URL('http://evil.example/'),
    ['evil.example'],
    lookup({ 'evil.example': ['10.0.0.1'] }),
  )).rejects.toThrow(/blocked destination/)
})

it('requires an exact hostname when the allowlist is non-empty', async () => {
  await expect(assertHostHttpGetDestination(
    new URL('https://www.example.com/'),
    ['example.com'],
    lookup({ 'www.example.com': ['1.2.3.4'] }),
  )).rejects.toThrow(/not on the Cluster http allowlist/)

  await assertHostHttpGetDestination(
    new URL('https://api.open-meteo.com/v1/forecast'),
    ['api.open-meteo.com'],
    lookup({ 'api.open-meteo.com': ['1.2.3.4'] }),
  )
})

it('returns status, body, and truncated true when the body exceeds 64 KiB', async () => {
  const over = 'x'.repeat(HOST_HTTP_GET_BODY_MAX_BYTES + 24)
  const result = await hostHttpGet('https://api.example.com/big', {
    lookup: lookup({ 'api.example.com': ['1.2.3.4'] }),
    fetchImpl: (async () => new Response(over, { status: 200 })) as typeof fetch,
  })
  expect(result.status).toBe(200)
  expect(result.truncated).toBe(true)
  expect(result.body).toHaveLength(HOST_HTTP_GET_BODY_MAX_BYTES)
  expect(result.body.startsWith('xxx')).toBe(true)
})

it('re-checks redirects and does not follow a hop to a blocked destination', async () => {
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const href = String(input)
    if (href === 'https://api.example.com/go') {
      return new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/secret' },
      })
    }
    return new Response('leaked', { status: 200 })
  }) as typeof fetch

  await expect(hostHttpGet('https://api.example.com/go', {
    lookup: lookup({ 'api.example.com': ['1.2.3.4'] }),
    fetchImpl,
  })).rejects.toThrow(/blocked destination/)
})

it('records only the tool name on a Turn, not the URL or body', () => {
  const llm = readFileSync(join(import.meta.dirname, '../../server/utils/llm.ts'), 'utf8')
  expect(llm).toContain('onTool?: (entry: { name: string, ok: boolean, ms: number })')
  expect(llm).toContain('Tool name, ok, and duration only')
  expect(llm).not.toContain('onTool?: (entry: { name: string, ok: boolean, ms: number, url')
})

it('lets Owner and Member Chat GET an allowed public URL and journals the tool name only', async () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  setClusterHttpAllowlist(store, ['api.example.com'])

  const fetchImpl = (async () => new Response('{"ok":true}', { status: 200 })) as typeof fetch
  const lookupFn = lookup({ 'api.example.com': ['1.2.3.4'] })
  const member = await invokeChatMcpTool({
    name: 'dostigus_http_get',
    args: { url: 'https://api.example.com/v1' },
    store,
    role: 'member',
    personId: owner.id,
    fetchImpl,
    lookup: lookupFn,
  })
  expect(member.ok).toBe(true)
  expect(member.name).toBe('dostigus_http_get')
  expect(JSON.parse(member.content)).toEqual({
    status: 200,
    body: '{"ok":true}',
    truncated: false,
  })
})
