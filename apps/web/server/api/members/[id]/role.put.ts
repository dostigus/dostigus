type RoleBody = { role?: string }

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<RoleBody>(event).catch(() => ({} as RoleBody))
  try {
    const member = setHouseholdMemberRole(useStore(), id, body?.role)
    return { member }
  } catch (error) {
    throwStoreError(error)
  }
})
