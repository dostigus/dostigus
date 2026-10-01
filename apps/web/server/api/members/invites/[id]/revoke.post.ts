export default defineEventHandler(async (event) => {
  await requireOwnerOrAdminSession(event)
  const id = getRouterParam(event, 'id') ?? ''
  try {
    const invite = revokeHouseholdInvite(useStore(), id)
    return { invite }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
