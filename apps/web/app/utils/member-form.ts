import { HOST_STATUS_MESSAGE_KEYS, hostStatusMessage } from './host-status-copy'

export type MemberFormField = 'displayName' | 'login' | 'password' | 'form'

type StatusKey = (typeof HOST_STATUS_MESSAGE_KEYS)[keyof typeof HOST_STATUS_MESSAGE_KEYS]

const FIELD_BY_KEY: Partial<Record<StatusKey, MemberFormField>> = {
  'auth.error.displayNameRequired': 'displayName',
  'auth.error.displayNameMax': 'displayName',
  'auth.error.invalidLogin': 'login',
  'auth.error.loginRequired': 'login',
  'auth.error.loginTooLong': 'login',
  'auth.error.usernameMin': 'login',
  'auth.error.usernameMax': 'login',
  'auth.error.usernameChars': 'login',
  'auth.error.alreadyOnHost': 'login',
  'auth.error.passwordRequired': 'password',
  'auth.error.passwordMin': 'password',
  'auth.error.passwordMax': 'password',
}

/** The Add Member field an API error sits under. `form` when it names no single field. */
export function memberErrorField(error: unknown): MemberFormField {
  const message = hostStatusMessage(error)
  const key = HOST_STATUS_MESSAGE_KEYS[message as keyof typeof HOST_STATUS_MESSAGE_KEYS]
  return (key && FIELD_BY_KEY[key]) ?? 'form'
}
