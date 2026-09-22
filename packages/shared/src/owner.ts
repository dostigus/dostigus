import { trimOrUndefined } from './llm-gateway'

export const OWNER_PASSWORD_MIN_LENGTH = 8
export const OWNER_PASSWORD_MAX_LENGTH = 128
export const OWNER_LOGIN_MAX_LENGTH = 254
export const OWNER_USERNAME_MIN_LENGTH = 2
export const OWNER_USERNAME_MAX_LENGTH = 32

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[A-Z0-9]{2,24}$/i
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{0,30}[a-z0-9]$/

export type OwnerIdentifier = {
  email: string | null
  username: string | null
}

export function looksLikeEmail(value: string): boolean {
  return value.includes('@')
}

export function normalizeOwnerEmail(value: string): string | undefined {
  return trimOrUndefined(value)?.toLowerCase()
}

export function normalizeOwnerUsername(value: string): string | undefined {
  return trimOrUndefined(value)?.toLowerCase()
}

export function parseOwnerIdentifier(value: string | undefined): OwnerIdentifier {
  const login = trimOrUndefined(value)
  if (!login) {
    throw new Error('Email or username is required')
  }
  if (login.length > OWNER_LOGIN_MAX_LENGTH) {
    throw new Error(`Email or username must be ${OWNER_LOGIN_MAX_LENGTH} characters or fewer`)
  }
  if (looksLikeEmail(login)) {
    const email = normalizeOwnerEmail(login)
    if (!email || !EMAIL_RE.test(email)) {
      throw new Error('Enter a valid email')
    }
    return { email, username: null }
  }
  const username = normalizeOwnerUsername(login)
  if (!username || username.length < OWNER_USERNAME_MIN_LENGTH) {
    throw new Error(`Username must be at least ${OWNER_USERNAME_MIN_LENGTH} characters`)
  }
  if (username.length > OWNER_USERNAME_MAX_LENGTH) {
    throw new Error(`Username must be ${OWNER_USERNAME_MAX_LENGTH} characters or fewer`)
  }
  if (!USERNAME_RE.test(username)) {
    throw new Error('Username may use letters, numbers, dots, underscores, and hyphens')
  }
  return { email: null, username }
}

/** Name shown on the Owner's Chat lines. Onboarding stores a login, not a separate display name. */
export function ownerDisplayName(owner: { username: string | null, email: string | null }): string {
  return owner.username ?? owner.email ?? 'Owner'
}

export function parseOwnerPassword(value: string | undefined): string {
  const password = value ?? ''
  if (password.length < OWNER_PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${OWNER_PASSWORD_MIN_LENGTH} characters`)
  }
  if (password.length > OWNER_PASSWORD_MAX_LENGTH) {
    throw new Error(`Password must be ${OWNER_PASSWORD_MAX_LENGTH} characters or fewer`)
  }
  return password
}
