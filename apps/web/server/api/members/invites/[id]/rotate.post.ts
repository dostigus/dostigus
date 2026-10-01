function originFromEvent(event: Parameters<typeof getRequestHeader>[0]): string {
  return inviteOrigin({
    host: getRequestHeader(event, 'host'),
    forwardedHost: getRequestHeader(event, 'x-forwarded-host'),
    forwardedProto: getRequestHeader(event, 'x-forwarded-proto'),
  })
}

export default defineEventHandler(async (event) => {
  const session = await requireOwnerOrAdminSession(event)
  const id = getRouterParam(event, 'id') ?? ''
  try {
    const issued = rotateHouseholdInvite(
      useStore(),
      id,
      inviteIssuerId(useStore(), session.user),
      originFromEvent(event),
    )
    return issued
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
