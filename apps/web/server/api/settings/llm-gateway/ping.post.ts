import { getLlmGatewaySettings } from '@dostigus/db'

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  try {
    const stored = getLlmGatewaySettings(useStore())
    return await pingLlmGateway({ stored })
  } catch (error) {
    throwStoreError(error)
  }
})
