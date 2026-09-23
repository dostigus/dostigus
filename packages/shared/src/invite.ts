import { trimOrUndefined } from './llm-gateway'
import { looksLikeEmail, parseOwnerIdentifier } from './owner'

/** One-shot Household Invite lifetime. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Email reserved by an Invite. Usernames are not Invites. */
export function parseInviteEmail(value: string | undefined): string {
  const login = trimOrUndefined(value)
  if (!login || !looksLikeEmail(login)) {
    throw new Error('Enter a valid email')
  }
  const email = parseOwnerIdentifier(login).email
  if (!email) {
    throw new Error('Enter a valid email')
  }
  return email
}
