type LoginBody = OwnerAuthBody

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginBody>(event).catch(() => ({} as LoginBody))
  try {
    const account = await loginHostAccount(useStore(), body, verifyPassword)
    await startOwnerSession(event, account)
    return { account }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
