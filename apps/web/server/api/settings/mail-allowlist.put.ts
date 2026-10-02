import { setMailAllowlist } from '@dostigus/db'

type PutBody = {
  entries?: unknown
}

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  const body = await readBody<PutBody>(event).catch(() => ({} as PutBody))
  try {
    return { entries: setMailAllowlist(useStore(), body?.entries ?? []) }
  } catch (error) {
    throwStoreError(error)
  }
})
