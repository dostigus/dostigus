type AcceptBody = {
  displayName?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? ''
  const body = await readBody<AcceptBody>(event).catch(() => ({} as AcceptBody))
  try {
    await refuseSignedInInvite(event)
    const member = await acceptHouseholdInvite(useStore(), token, body, hashPassword)
    await startOwnerSession(event, toMemberSession(member))
    setResponseStatus(event, 201)
    return { member }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
