type LoginBody = OwnerAuthBody

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginBody>(event).catch(() => ({} as LoginBody))
  try {
    const owner = await loginClusterOwner(useStore(), body, verifyPassword)
    await startOwnerSession(event, toOwnerSession(owner))
    return { owner }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
