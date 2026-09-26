import type { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync as Sqlite } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import {
  getLlmGatewaySettings,
  LLM_GATEWAY_API_KEY_DROP_ID,
  llmGatewayHasApiKeyColumn,
  migrateLegacyLlmGatewayApiKey,
  openStore,
  STORE_MIGRATIONS,
} from '../../src/index'

const opened: Array<{ close: () => void }> = []

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

const LEGACY = {
  id: 'legacy',
  kind: 'openrouter',
  apiKey: null,
  baseUrl: null,
  defaultModel: null,
}

function applyBeforeDrop(sqlite: DatabaseSync): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __store_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)
  const insert = sqlite.prepare(
    'INSERT INTO __store_migrations (id, applied_at) VALUES (?, ?)',
  )
  for (const migration of STORE_MIGRATIONS) {
    if (migration.id === LLM_GATEWAY_API_KEY_DROP_ID) {
      break
    }
    sqlite.exec(migration.sql)
    insert.run(migration.id, Date.now())
  }
}

function seedGateway(
  sqlite: DatabaseSync,
  input: { apiKey: string | null, providers: unknown[] },
): void {
  sqlite.prepare(`
    INSERT INTO llm_gateway (
      id, base_url, api_key, default_tier, models_json, providers_json, tier_binds_json, updated_at
    )
    VALUES ('cluster', NULL, ?, 'strong', '{}', ?, '{}', 1)
  `).run(input.apiKey, JSON.stringify(input.providers))
}

function leftoverKey(sqlite: DatabaseSync): string | null {
  const row = sqlite.prepare('SELECT api_key FROM llm_gateway WHERE id = ?').get('cluster') as
    | { api_key: string | null }
    | undefined
  return row?.api_key ?? null
}

function providersJson(sqlite: DatabaseSync): unknown[] {
  const row = sqlite.prepare('SELECT providers_json FROM llm_gateway WHERE id = ?').get('cluster') as
    | { providers_json: string }
    | undefined
  return row ? JSON.parse(row.providers_json) as unknown[] : []
}

it('copies a leftover field key onto an empty Provider and wipes the field', () => {
  const sqlite = new Sqlite(':memory:')
  opened.push(sqlite)
  applyBeforeDrop(sqlite)
  seedGateway(sqlite, { apiKey: 'sk-legacy-only', providers: [LEGACY] })

  migrateLegacyLlmGatewayApiKey(sqlite)

  expect(leftoverKey(sqlite)).toBeNull()
  expect(providersJson(sqlite)).toEqual([{ ...LEGACY, apiKey: 'sk-legacy-only' }])
})

it('wipes the leftover field when only the Provider has a key', () => {
  const sqlite = new Sqlite(':memory:')
  opened.push(sqlite)
  applyBeforeDrop(sqlite)
  seedGateway(sqlite, {
    apiKey: '',
    providers: [{ ...LEGACY, apiKey: 'sk-provider' }],
  })

  migrateLegacyLlmGatewayApiKey(sqlite)

  expect(leftoverKey(sqlite)).toBeNull()
  expect(providersJson(sqlite)).toEqual([{ ...LEGACY, apiKey: 'sk-provider' }])
})

it('keeps the Provider key when both differ and wipes the field', () => {
  const sqlite = new Sqlite(':memory:')
  opened.push(sqlite)
  applyBeforeDrop(sqlite)
  seedGateway(sqlite, {
    apiKey: 'sk-old-field',
    providers: [{ ...LEGACY, apiKey: 'sk-provider-wins' }],
  })

  migrateLegacyLlmGatewayApiKey(sqlite)

  expect(leftoverKey(sqlite)).toBeNull()
  expect(providersJson(sqlite)).toEqual([{ ...LEGACY, apiKey: 'sk-provider-wins' }])
})

it('is idempotent and a no-op after the column is gone', () => {
  const sqlite = new Sqlite(':memory:')
  opened.push(sqlite)
  applyBeforeDrop(sqlite)
  seedGateway(sqlite, { apiKey: 'sk-legacy-only', providers: [LEGACY] })
  migrateLegacyLlmGatewayApiKey(sqlite)
  migrateLegacyLlmGatewayApiKey(sqlite)
  expect(leftoverKey(sqlite)).toBeNull()
  expect(providersJson(sqlite)).toEqual([{ ...LEGACY, apiKey: 'sk-legacy-only' }])
})

it('migrates then drops llm_gateway.api_key on Store open', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dostigus-llm-key-'))
  const path = join(dir, 'cluster.sqlite')
  const sqlite = new Sqlite(path)
  applyBeforeDrop(sqlite)
  seedGateway(sqlite, { apiKey: 'sk-boot', providers: [LEGACY] })
  expect(llmGatewayHasApiKeyColumn(sqlite)).toBe(true)
  sqlite.close()

  const store = openStore(`file:${path}`)
  opened.push(store)
  expect(llmGatewayHasApiKeyColumn(store.sqlite)).toBe(false)
  expect(getLlmGatewaySettings(store).providers).toEqual([
    { ...LEGACY, apiKey: 'sk-boot' },
  ])
  expect(getLlmGatewaySettings(store)).not.toHaveProperty('apiKey')
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

it('drops llm_gateway.api_key on a fresh Store', () => {
  const store = openStore('file::memory:')
  opened.push(store)
  expect(llmGatewayHasApiKeyColumn(store.sqlite)).toBe(false)
  expect(getLlmGatewaySettings(store)).not.toHaveProperty('apiKey')
})
