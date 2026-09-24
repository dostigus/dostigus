import { getClusterHttpAllowlist } from '@dostigus/db'

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  try {
    return { hosts: getClusterHttpAllowlist(useStore()) }
  } catch (error) {
    throwStoreError(error)
  }
})
