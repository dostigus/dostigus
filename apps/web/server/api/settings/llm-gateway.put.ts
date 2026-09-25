import type { LlmProviderInstance, LlmTierBind, ModelTier } from '@dostigus/shared'
import { upsertLlmGatewaySettings } from '@dostigus/db'

type PutBody = {
  baseUrl?: string | null
  apiKey?: string | null
  clearApiKey?: boolean
  defaultTier?: string
  modelOverrides?: Partial<Record<ModelTier, string>>
  providers?: Array<LlmProviderInstance & { clearApiKey?: boolean }>
  tierBinds?: Partial<Record<ModelTier, LlmTierBind>>
}

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  const body = await readBody<PutBody>(event).catch(() => ({} as PutBody))
  try {
    upsertLlmGatewaySettings(useStore(), {
      baseUrl: body?.baseUrl,
      apiKey: body?.apiKey,
      clearApiKey: body?.clearApiKey,
      defaultTier: body?.defaultTier,
      modelOverrides: body?.modelOverrides,
      providers: body?.providers,
      tierBinds: body?.tierBinds,
    })
    return { llmGateway: publicLlmGateway() }
  } catch (error) {
    throwStoreError(error)
  }
})
