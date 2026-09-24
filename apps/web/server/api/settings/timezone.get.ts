import { effectiveClusterTimeZone } from '@dostigus/db'

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  try {
    return { timezone: effectiveClusterTimeZone(useStore()) }
  } catch (error) {
    throwStoreError(error)
  }
})
