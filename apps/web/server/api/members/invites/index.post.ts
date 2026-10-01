type CreateBody = { email?: string }

function originFromEvent(event: Parameters<typeof getRequestHeader>[0]): string {
  return inviteOrigin({
    host: getRequestHeader(event, 'host'),
    forwardedHost: getRequestHeader(event, 'x-forwarded-host'),
    forwardedProto: getRequestHeader(event, 'x-forwarded-proto'),
  })
}

export default defineEventHandler(async (event) => {
  const session = await requireOwnerOrAdminSession(event)
  const body = await readBody<CreateBody>(event).catch(() => ({} as CreateBody))
  try {
    const issued = createHouseholdInvite(
      useStore(),
      body,
      inviteIssuerId(useStore(), session.user),
      originFromEvent(event),
    )
    setResponseStatus(event, 201)
    return issued
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
