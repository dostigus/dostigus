import { seedMemberLocale } from '@dostigus/db'

type AcceptBody = {
  displayName?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? ''
  const body = await readBody<AcceptBody>(event).catch(() => ({} as AcceptBody))
  try {
    await refuseSignedInInvite(event)
    const store = useStore()
    const member = await acceptHouseholdInvite(store, token, body, hashPassword)
    const seeded = seedMemberLocale(store, member.id, readLocaleCookie(event))
    await startOwnerSession(event, toMemberSession(seeded))
    setResponseStatus(event, 201)
    return { member }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
