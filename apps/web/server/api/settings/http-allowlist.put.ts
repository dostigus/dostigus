import { setClusterHttpAllowlist } from '@dostigus/db'

type PutBody = {
  hosts?: unknown
}

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  const body = await readBody<PutBody>(event).catch(() => ({} as PutBody))
  try {
    return { hosts: setClusterHttpAllowlist(useStore(), body?.hosts ?? []) }
  } catch (error) {
    throwStoreError(error)
  }
})
