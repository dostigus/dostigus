import process from 'node:process'
import { getLlmGatewaySettings } from '@dostigus/db'

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  const providerId = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  const refresh = getQuery(event).refresh
  try {
    const stored = getLlmGatewaySettings(useStore())
    return {
      catalog: await loadOpenRouterCatalog({
        stored,
        providerId,
        refresh: refresh === '1' || refresh === 'true',
        trustKey: previewCatalogSkipsKeyProbe({
          dev: import.meta.dev,
          flag: process.env.DOSTIGUS_PREVIEW_SEED,
          providerId,
        }),
      }),
    }
  } catch (error) {
    throwStoreError(error)
  }
})
