import { getMailAllowlist } from '@dostigus/db'

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  try {
    return { entries: getMailAllowlist(useStore()) }
  } catch (error) {
    throwStoreError(error)
  }
})
