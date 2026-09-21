type RegisterBody = OwnerAuthBody

export default defineEventHandler(async (event) => {
  const body = await readBody<RegisterBody>(event).catch(() => ({} as RegisterBody))
  try {
    const owner = await registerClusterOwner(useStore(), body, hashPassword)
    await startOwnerSession(event, toOwnerSession(owner))
    setResponseStatus(event, 201)
    return { owner }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
