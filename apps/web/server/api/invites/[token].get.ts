export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? ''
  try {
    await refuseSignedInInvite(event)
    return readHouseholdInvite(useStore(), token)
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
