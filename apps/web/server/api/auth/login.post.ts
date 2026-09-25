import { seedMemberLocale } from '@dostigus/db'

type LoginBody = OwnerAuthBody

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginBody>(event).catch(() => ({} as LoginBody))
  try {
    const store = useStore()
    const account = await loginHostAccount(store, body, verifyPassword)
    if (account.role === 'member') {
      const seeded = seedMemberLocale(store, account.id, readLocaleCookie(event))
      account.locale = seeded.locale
    }
    await startOwnerSession(event, account)
    return { account }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
