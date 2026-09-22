import type { OpenedStore } from '@dostigus/db'
import type { Member } from '@dostigus/shared'
import { createMember, disableMember, listMembers } from '@dostigus/db'
import { parseMemberDisplayName, parseOwnerIdentifier, parseOwnerPassword } from '@dostigus/shared'
import { OwnerAuthError } from './owner-auth'

export type MemberCreateBody = {
  displayName?: string
  login?: string
  password?: string
}

export function listHouseholdMembers(store: OpenedStore): Member[] {
  return listMembers(store)
}

export function disableHouseholdMember(store: OpenedStore, id: string): Member {
  return disableMember(store, id)
}

export async function addHouseholdMember(
  store: OpenedStore,
  body: MemberCreateBody,
  hashPassword: (password: string) => Promise<string>,
): Promise<Member> {
  let displayName: string
  let email: string | null = null
  let username: string | null = null
  let password: string
  try {
    displayName = parseMemberDisplayName(body.displayName)
    const identifier = parseOwnerIdentifier(body.login)
    email = identifier.email
    username = identifier.username
    password = parseOwnerPassword(body.password)
  } catch (error) {
    throw new OwnerAuthError(
      error instanceof Error ? error.message : 'Check the Member details',
      400,
    )
  }
  const passwordHash = await hashPassword(password)
  return createMember(store, {
    displayName,
    email,
    username,
    passwordHash,
  })
}
