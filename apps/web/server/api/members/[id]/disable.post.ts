export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  const id = getRouterParam(event, 'id') ?? ''
  try {
    const member = disableHouseholdMember(useStore(), id)
    return { member }
  } catch (error) {
    throwStoreError(error)
  }
})
