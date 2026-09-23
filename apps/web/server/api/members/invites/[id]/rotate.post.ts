function originFromEvent(event: Parameters<typeof getRequestHeader>[0]): string {
  return inviteOrigin({
    host: getRequestHeader(event, 'host'),
    forwardedHost: getRequestHeader(event, 'x-forwarded-host'),
    forwardedProto: getRequestHeader(event, 'x-forwarded-proto'),
  })
}

export default defineEventHandler(async (event) => {
  const session = await requireOwnerSession(event)
  const createdBy = session.user?.id
  if (!createdBy) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }
  const id = getRouterParam(event, 'id') ?? ''
  try {
    const issued = rotateHouseholdInvite(useStore(), id, createdBy, originFromEvent(event))
    return issued
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
