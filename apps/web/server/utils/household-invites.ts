import type { OpenedStore } from '@dostigus/db'
import type { Invite } from '@dostigus/shared'
import {
  acceptInvite,
  issueInvite,
  listPendingInvites,
  readAcceptableInvite,
  revokeInvite,
  rotateInvite,
} from '@dostigus/db'
import { parseInviteEmail, parseMemberDisplayName, parseOwnerPassword } from '@dostigus/shared'
import { OwnerAuthError } from './owner-auth'
import { readOwnerSession } from './owner-session'

export type InviteOriginInput = {
  host?: string | null
  forwardedHost?: string | null
  forwardedProto?: string | null
}

const HOST_RE = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i
const IPV6_HOST_RE = /^\[[0-9a-f:]+\](?::\d{1,5})?$/i

function isSafeHost(host: string): boolean {
  if (!host || host.length > 255) {
    return false
  }
  if (host.startsWith('[')) {
    return IPV6_HOST_RE.test(host)
  }
  return HOST_RE.test(host)
}

function hostnameOf(host: string): string {
  if (host.startsWith('[')) {
    return host.slice(1, host.indexOf(']')).toLowerCase()
  }
  return host.replace(/:\d+$/, '').toLowerCase()
}

function isLoopback(host: string): boolean {
  const name = hostnameOf(host)
  return name === 'localhost' || name === '127.0.0.1' || name === '::1'
}

/**
 * Invite URL origin from the Owner request.
 * Public hosts are https. Loopback keeps http unless the proxy said https,
 * so nuxt dev copy-paste opens.
 */
export function inviteOrigin(input: InviteOriginInput): string {
  const forwarded = input.forwardedHost?.split(',')[0]?.trim()
  const host = forwarded || input.host?.trim() || ''
  if (!isSafeHost(host)) {
    throw new OwnerAuthError('This Host could not build the invite link', 400)
  }
  if (!isLoopback(host)) {
    return `https://${host}`
  }
  const proto = input.forwardedProto?.split(',')[0]?.trim().toLowerCase()
  const scheme = proto === 'https' ? 'https' : 'http'
  return `${scheme}://${host}`
}

export function inviteUrl(origin: string, token: string): string {
  return `${origin}/invite/${token}`
}

export function listHouseholdInvites(store: OpenedStore): Invite[] {
  return listPendingInvites(store)
}

export function createHouseholdInvite(
  store: OpenedStore,
  body: { email?: string },
  createdBy: string,
  origin: string,
): { invite: Invite, url: string } {
  try {
    parseInviteEmail(body.email)
  } catch (error) {
    throw new OwnerAuthError(error instanceof Error ? error.message : 'Enter a valid email', 400)
  }
  const issued = issueInvite(store, {
    email: body.email ?? '',
    createdBy,
  })
  return {
    invite: issued.invite,
    url: inviteUrl(origin, issued.token),
  }
}

export function revokeHouseholdInvite(store: OpenedStore, id: string): Invite {
  return revokeInvite(store, id)
}

export function rotateHouseholdInvite(
  store: OpenedStore,
  id: string,
  createdBy: string,
  origin: string,
): { invite: Invite, url: string } {
  const issued = rotateInvite(store, id, createdBy)
  return {
    invite: issued.invite,
    url: inviteUrl(origin, issued.token),
  }
}

export function readHouseholdInvite(store: OpenedStore, token: string): { email: string, expiresAt: string } {
  return readAcceptableInvite(store, token)
}

export async function acceptHouseholdInvite(
  store: OpenedStore,
  token: string,
  body: { displayName?: string, password?: string },
  hashPassword: (password: string) => Promise<string>,
) {
  let displayName: string
  let password: string
  try {
    displayName = parseMemberDisplayName(body.displayName)
    password = parseOwnerPassword(body.password)
  } catch (error) {
    throw new OwnerAuthError(
      error instanceof Error ? error.message : 'Check the Member details',
      400,
    )
  }
  const passwordHash = await hashPassword(password)
  return acceptInvite(store, { token, displayName, passwordHash })
}

/** Accept stays logged out. An existing Host session must not create a Member. */
export async function refuseSignedInInvite(event: object): Promise<void> {
  const session = await readOwnerSession(event)
  if (session?.user?.id) {
    throw new OwnerAuthError('Sign out, then open this link again', 409)
  }
}
