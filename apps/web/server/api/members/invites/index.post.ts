type CreateBody = { email?: string }

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
  const body = await readBody<CreateBody>(event).catch(() => ({} as CreateBody))
  try {
    const issued = createHouseholdInvite(useStore(), body, createdBy, originFromEvent(event))
    setResponseStatus(event, 201)
    return issued
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
