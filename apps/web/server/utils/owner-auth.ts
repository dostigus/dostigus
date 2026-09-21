import type { OpenedStore, OwnerSecret } from '@dostigus/db'
import type { Owner } from '@dostigus/shared'
import { createOwner, findOwnerSecretByLogin, StoreError, ownerExists as storeOwnerExists } from '@dostigus/db'
import { parseOwnerIdentifier, parseOwnerPassword, trimOrUndefined } from '@dostigus/shared'

export class OwnerAuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
    this.name = 'OwnerAuthError'
  }
}

export type OwnerAuthBody = {
  login?: string
  email?: string
  username?: string
  password?: string
}

export type OwnerSessionUser = {
  id: string
  email: string | null
  username: string | null
}

export function toOwnerSession(owner: Owner): OwnerSessionUser {
  return {
    id: owner.id,
    email: owner.email,
    username: owner.username,
  }
}

export function assertOwnerSession(
  session: { user?: { id?: string } } | null | undefined,
): asserts session is { user: { id: string } } {
  if (!session?.user?.id) {
    throw new OwnerAuthError('Owner session required', 401)
  }
}

function resolveIdentifier(body: OwnerAuthBody) {
  const email = trimOrUndefined(body.email)
  const username = trimOrUndefined(body.username)
  if (email || username) {
    try {
      return {
        email: email ? parseOwnerIdentifier(email).email : null,
        username: username ? parseOwnerIdentifier(username).username : null,
      }
    } catch (error) {
      throw new OwnerAuthError(error instanceof Error ? error.message : 'Invalid email or username', 400)
    }
  }
  try {
    return parseOwnerIdentifier(body.login)
  } catch (error) {
    throw new OwnerAuthError(error instanceof Error ? error.message : 'Email or username is required', 400)
  }
}

function resolveRegisterPassword(value: string | undefined): string {
  try {
    return parseOwnerPassword(value)
  } catch (error) {
    throw new OwnerAuthError(error instanceof Error ? error.message : 'Password is required', 400)
  }
}

export async function registerClusterOwner(
  store: OpenedStore,
  body: OwnerAuthBody,
  hashPassword: (password: string) => Promise<string>,
): Promise<Owner> {
  if (storeOwnerExists(store)) {
    throw new OwnerAuthError('This Cluster already has an Owner', 409)
  }
  const identifier = resolveIdentifier(body)
  const passwordHash = await hashPassword(resolveRegisterPassword(body.password))
  return createOwner(store, {
    email: identifier.email,
    username: identifier.username,
    passwordHash,
  })
}

export async function loginClusterOwner(
  store: OpenedStore,
  body: OwnerAuthBody,
  verifyPassword: (hash: string, password: string) => Promise<boolean>,
): Promise<Owner> {
  const login = trimOrUndefined(body.login)
    ?? trimOrUndefined(body.email)
    ?? trimOrUndefined(body.username)
  const password = body.password ?? ''
  if (!login || !password) {
    throw new OwnerAuthError('Invalid email, username, or password', 401)
  }

  let secret: OwnerSecret | undefined
  try {
    secret = findOwnerSecretByLogin(store, login)
  } catch {
    throw new OwnerAuthError('Invalid email, username, or password', 401)
  }
  if (!secret || !(await verifyPassword(secret.passwordHash, password))) {
    throw new OwnerAuthError('Invalid email, username, or password', 401)
  }
  return {
    id: secret.id,
    email: secret.email,
    username: secret.username,
    createdAt: secret.createdAt,
  }
}

export function throwOwnerAuthError(error: unknown): never {
  if (error instanceof OwnerAuthError || error instanceof StoreError) {
    throw createError({
      statusCode: error.statusCode,
      statusMessage: error.message,
    })
  }
  throw error
}
