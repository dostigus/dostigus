/** One-shot copy of `llm_gateway.api_key` onto a Provider, then wipe. See ADR 0036. */

import type { LlmProviderInstance } from '@dostigus/shared'
import type { DatabaseSync } from 'node:sqlite'
import {
  inferLlmProviderKind,
  isLlmProviderKind,
  LEGACY_LLM_PROVIDER_ID,
  trimOrUndefined,
} from '@dostigus/shared'

export const LLM_GATEWAY_API_KEY_DROP_ID = '0023_drop_llm_gateway_api_key'

const LLM_GATEWAY_ID = 'cluster'

export function llmGatewayHasApiKeyColumn(sqlite: DatabaseSync): boolean {
  const columns = sqlite.prepare('PRAGMA table_info(llm_gateway)').all() as Array<{ name: string }>
  return columns.some((column) => column.name === 'api_key')
}

function parseProviders(raw: string | null | undefined): LlmProviderInstance[] {
  if (!raw) {
    return []
  }
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) {
      return []
    }
    const out: LlmProviderInstance[] = []
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        continue
      }
      const record = item as Record<string, unknown>
      const id = typeof record.id === 'string' ? record.id.trim() : ''
      const kind = typeof record.kind === 'string' ? record.kind : ''
      if (!id || !isLlmProviderKind(kind)) {
        continue
      }
      out.push({
        id,
        kind,
        apiKey: typeof record.apiKey === 'string' && record.apiKey.trim()
          ? record.apiKey
          : null,
        baseUrl: typeof record.baseUrl === 'string' && record.baseUrl.trim()
          ? record.baseUrl.trim()
          : null,
        defaultModel: typeof record.defaultModel === 'string' && record.defaultModel.trim()
          ? record.defaultModel.trim()
          : null,
      })
    }
    return out
  } catch {
    return []
  }
}

function targetProviderIndex(providers: LlmProviderInstance[]): number {
  const legacy = providers.findIndex((provider) => provider.id === LEGACY_LLM_PROVIDER_ID)
  if (legacy >= 0) {
    return legacy
  }
  return providers.findIndex((provider) => provider.kind === 'openrouter')
}

/**
 * On Store open, before DROP COLUMN: copy a leftover `llm_gateway.api_key`
 * onto Provider id `legacy` (or the OpenRouter Provider) when that instance
 * has no key. Never overwrite a Provider that already has a key. Then wipe
 * the field. Idempotent.
 */
export function migrateLegacyLlmGatewayApiKey(sqlite: DatabaseSync): void {
  if (!llmGatewayHasApiKeyColumn(sqlite)) {
    return
  }

  const row = sqlite.prepare(`
    SELECT base_url, api_key, providers_json
    FROM llm_gateway
    WHERE id = ?
  `).get(LLM_GATEWAY_ID) as {
    base_url: string | null
    api_key: string | null
    providers_json: string
  } | undefined
  if (!row) {
    return
  }

  const leftoverKey = trimOrUndefined(row.api_key) ?? null
  const providers = parseProviders(row.providers_json)
  let next = providers
  let providersChanged = false

  if (leftoverKey) {
    const index = targetProviderIndex(providers)
    if (index >= 0) {
      if (!trimOrUndefined(providers[index]?.apiKey)) {
        next = providers.map((provider, i) => {
          return i === index ? { ...provider, apiKey: leftoverKey } : provider
        })
        providersChanged = true
      }
    } else {
      next = [
        ...providers,
        {
          id: LEGACY_LLM_PROVIDER_ID,
          kind: inferLlmProviderKind(row.base_url),
          apiKey: leftoverKey,
          baseUrl: trimOrUndefined(row.base_url) ?? null,
          defaultModel: null,
        },
      ]
      providersChanged = true
    }
  }

  if (providersChanged) {
    sqlite.prepare(`
      UPDATE llm_gateway
      SET providers_json = ?, api_key = NULL, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(next), Date.now(), LLM_GATEWAY_ID)
    return
  }

  if (row.api_key != null) {
    sqlite.prepare(`
      UPDATE llm_gateway
      SET api_key = NULL, updated_at = ?
      WHERE id = ?
    `).run(Date.now(), LLM_GATEWAY_ID)
  }
}
