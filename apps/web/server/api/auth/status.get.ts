import { ownerExists } from '@dostigus/db'

export default defineEventHandler(async (event) => {
  const session = await readOwnerSession(event)
  return {
    ownerExists: ownerExists(useStore()),
    loggedIn: Boolean(session.user),
    owner: session.user
      ? {
          id: session.user.id,
          email: session.user.email,
          username: session.user.username,
        }
      : null,
  }
})
