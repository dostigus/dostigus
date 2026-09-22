type CreateBody = MemberCreateBody

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  const body = await readBody<CreateBody>(event).catch(() => ({} as CreateBody))
  try {
    const member = await addHouseholdMember(useStore(), body, hashPassword)
    setResponseStatus(event, 201)
    return { member }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
