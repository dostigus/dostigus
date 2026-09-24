import { setClusterTimeZone } from '@dostigus/db'

type PutBody = {
  timezone?: string
}

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  const body = await readBody<PutBody>(event).catch(() => ({} as PutBody))
  try {
    return { timezone: setClusterTimeZone(useStore(), body?.timezone ?? '') }
  } catch (error) {
    throwStoreError(error)
  }
})
