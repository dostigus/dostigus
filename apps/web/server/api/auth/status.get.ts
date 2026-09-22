import { getMember, getOwner, ownerExists } from '@dostigus/db'
import { ownerDisplayName } from '@dostigus/shared'

export default defineEventHandler(async (event) => {
  const session = await readOwnerSession(event)
  const store = useStore()
  const user = session.user
  let account: {
    id: string
    email: string | null
    username: string | null
    displayName: string
    role: 'owner' | 'member'
  } | null = null

  if (user?.id && user.role === 'member') {
    const member = getMember(store, user.id)
    if (member && !member.disabledAt) {
      account = {
        id: member.id,
        email: member.email,
        username: member.username,
        displayName: member.displayName,
        role: 'member',
      }
    }
  } else if (user?.id) {
    const owner = getOwner(store, user.id)
    account = {
      id: user.id,
      email: user.email ?? owner?.email ?? null,
      username: user.username ?? owner?.username ?? null,
      displayName: owner ? ownerDisplayName(owner) : (user.displayName || 'Owner'),
      role: 'owner',
    }
  }

  return {
    ownerExists: ownerExists(store),
    loggedIn: Boolean(account),
    account,
  }
})
