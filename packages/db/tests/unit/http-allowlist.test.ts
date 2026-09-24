import { afterEach, expect, it } from 'vitest'
import {
  createOwner,
  getClusterHttpAllowlist,
  httpAllowlistAllows,
  normalizeHttpAllowlist,
  openStore,
  setClusterHttpAllowlist,
  setClusterTimeZone,
  StoreError,
} from '../../src/index'

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

it('treats a missing or empty allowlist as allow-all', () => {
  const store = memoryStore()
  expect(getClusterHttpAllowlist(store)).toEqual([])
  expect(httpAllowlistAllows('api.open-meteo.com', [])).toBe(true)
  expect(httpAllowlistAllows('127.0.0.1', [])).toBe(true)

  expect(setClusterHttpAllowlist(store, [])).toEqual([])
  expect(getClusterHttpAllowlist(store)).toEqual([])
  expect(httpAllowlistAllows('example.com', getClusterHttpAllowlist(store))).toBe(true)
})

it('stores exact hostnames and matches case-insensitive without suffix or wildcard', () => {
  const store = memoryStore()
  expect(setClusterHttpAllowlist(store, [
    'API.Open-Meteo.com.',
    'api.open-meteo.com',
    'example.com',
  ])).toEqual(['api.open-meteo.com', 'example.com'])

  const list = getClusterHttpAllowlist(store)
  expect(httpAllowlistAllows('api.open-meteo.com', list)).toBe(true)
  expect(httpAllowlistAllows('API.OPEN-METEO.COM', list)).toBe(true)
  expect(httpAllowlistAllows('open-meteo.com', list)).toBe(false)
  expect(httpAllowlistAllows('www.example.com', list)).toBe(false)
  expect(httpAllowlistAllows('example.com.evil.test', list)).toBe(false)
})

it('rejects path, scheme, wildcard, and port entries', () => {
  expect(() => normalizeHttpAllowlist(['https://example.com'])).toThrow(StoreError)
  expect(() => normalizeHttpAllowlist(['example.com/path'])).toThrow(StoreError)
  expect(() => normalizeHttpAllowlist(['*.example.com'])).toThrow(StoreError)
  expect(() => normalizeHttpAllowlist(['example.com:8443'])).toThrow(StoreError)
  expect(() => normalizeHttpAllowlist('example.com')).toThrow(StoreError)
})

it('keeps timezone and the allowlist on the same Cluster settings row', () => {
  const store = memoryStore()
  createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  setClusterTimeZone(store, 'America/New_York', { env: { DOSTIGUS_TZ: 'UTC' } })
  expect(setClusterHttpAllowlist(store, ['api.open-meteo.com'])).toEqual(['api.open-meteo.com'])
  expect(getClusterHttpAllowlist(store)).toEqual(['api.open-meteo.com'])
  const row = store.sqlite.prepare(
    'SELECT timezone, http_allowlist FROM cluster_settings WHERE id = ?',
  ).get('cluster') as { timezone: string, http_allowlist: string }
  expect(row.timezone).toBe('America/New_York')
  expect(JSON.parse(row.http_allowlist)).toEqual(['api.open-meteo.com'])
})
