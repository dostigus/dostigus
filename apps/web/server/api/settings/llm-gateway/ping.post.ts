import { getLlmGatewaySettings } from '@dostigus/db'

type PingBody = {
  providerId?: string
}

export default defineEventHandler(async (event) => {
  await requireOwnerOrAdminSession(event)
  const body = await readBody<PingBody>(event).catch(() => ({} as PingBody))
  try {
    const stored = getLlmGatewaySettings(useStore())
    return await pingLlmGateway({
      stored,
      providerId: body?.providerId,
    })
  } catch (error) {
    throwStoreError(error)
  }
})
