import type { OpenedStore } from '@dostigus/db'
import type { OwnerSessionUser } from './owner-auth'

export async function requireOwnerSession(event: object) {
  return requireUserSession(event as never)
}

export async function startOwnerSession(event: object, user: OwnerSessionUser) {
  await setUserSession(event as never, { user })
}

export async function endOwnerSession(event: object) {
  await clearUserSession(event as never)
}

export async function readOwnerSession(event: object) {
  return getUserSession(event as never)
}

export async function withOwnerStore<T>(
  event: object,
  fn: (store: OpenedStore) => T,
): Promise<T> {
  await requireOwnerSession(event)
  return withClusterStore(fn)
}
