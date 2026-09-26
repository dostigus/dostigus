/** English API statusMessage → Locale dictionary key. */
export const HOST_STATUS_MESSAGE_KEYS = {
  'Invalid email, username, or password': 'auth.error.invalidCredentials',
  'Invalid email or username': 'auth.error.invalidLogin',
  'Email or username is required': 'auth.error.loginRequired',
  'Password is required': 'auth.error.passwordRequired',
  'This Cluster already has an Owner': 'auth.error.clusterHasOwner',
  'Check the Member details': 'auth.error.checkMember',
  'This Host could not build the invite link': 'auth.error.inviteLink',
  'Enter a valid email': 'auth.error.validEmail',
  'Sign out, then open this link again': 'auth.error.signOutFirst',
  'Email or username must be 254 characters or fewer': 'auth.error.loginTooLong',
  'Username must be at least 2 characters': 'auth.error.usernameMin',
  'Username must be 32 characters or fewer': 'auth.error.usernameMax',
  'Username may use letters, numbers, dots, underscores, and hyphens': 'auth.error.usernameChars',
  'Password must be at least 8 characters': 'auth.error.passwordMin',
  'Password must be 128 characters or fewer': 'auth.error.passwordMax',
  'Display name is required': 'auth.error.displayNameRequired',
  'Display name must be 64 characters or fewer': 'auth.error.displayNameMax',
  'That email or username is already on this Host': 'auth.error.alreadyOnHost',
  'That email is already on this Host': 'auth.error.emailAlreadyOnHost',
  'This invite was already used': 'auth.error.inviteUsed',
  'This invite was revoked': 'auth.error.inviteRevoked',
  'This Host needs an Owner first': 'auth.error.needsOwner',
  'Every person in the room must already have access to that Bot': 'host.threadCreate.needAccess',
  'A room needs a Bot': 'host.threadCreate.pickBot',
  'A room needs at least two people': 'host.threadCreate.pickPeople',
  'A group needs at least two people': 'host.threadCreate.pickPeople',
  'A direct message is one person and another person': 'host.threadCreate.pickPerson',
  'Name this Thread': 'host.threadCreate.nameThread',
  'Cluster timezone must be an IANA name': 'settings.other.timezone.invalid',
  'HTTP allowlist entries are hostnames only': 'settings.other.allowlist.invalid',
  'HTTP allowlist entries are hostnames': 'settings.other.allowlist.invalid',
} as const

export function hostStatusMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const fetchError = error as { data?: { statusMessage?: string }, statusMessage?: string }
    const fromData = fetchError.data?.statusMessage?.trim()
    if (fromData) {
      return fromData
    }
    const fromStatus = fetchError.statusMessage?.trim()
    if (fromStatus) {
      return fromStatus
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }
  return ''
}

export function hostStatusCopy(
  error: unknown,
  translate: (key: string) => string,
  fallbackKey: string,
): string {
  const message = hostStatusMessage(error)
  if (!message) {
    return translate(fallbackKey)
  }
  const key = HOST_STATUS_MESSAGE_KEYS[message as keyof typeof HOST_STATUS_MESSAGE_KEYS]
  return key ? translate(key) : message
}
