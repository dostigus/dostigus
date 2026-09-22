import type { OpenedStore } from '@dostigus/db'
import type { HostSessionUser } from './owner-auth'
import { getMember } from '@dostigus/db'
import { isOwnerSessionUser } from './owner-auth'

export async function requireHostSession(event: object) {
  const session = await requireUserSession(event as never)
  const user = session.user
  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }
  if (user.role === 'member') {
    const member = getMember(useStore(), user.id)
    if (!member || member.disabledAt) {
      throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
    }
  }
  return session
}

export async function requireOwnerSession(event: object) {
  const session = await requireHostSession(event)
  if (!isOwnerSessionUser(session.user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only the Owner can change this',
    })
  }
  return session
}

export async function startOwnerSession(event: object, user: HostSessionUser) {
  await setUserSession(event as never, { user })
}

export async function endOwnerSession(event: object) {
  await clearUserSession(event as never)
}

export async function readOwnerSession(event: object) {
  return getUserSession(event as never)
}

export async function withHostStore<T>(
  event: object,
  fn: (store: OpenedStore) => T,
): Promise<T> {
  await requireHostSession(event)
  return withClusterStore(fn)
}

export async function withOwnerStore<T>(
  event: object,
  fn: (store: OpenedStore) => T,
): Promise<T> {
  await requireOwnerSession(event)
  return withClusterStore(fn)
}
