import { trimOrUndefined } from './llm-gateway'

export const MEMBER_DISPLAY_NAME_MAX_LENGTH = 64

export function parseMemberDisplayName(value: string | undefined): string {
  const name = trimOrUndefined(value)
  if (!name) {
    throw new Error('Display name is required')
  }
  if (name.length > MEMBER_DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Display name must be ${MEMBER_DISPLAY_NAME_MAX_LENGTH} characters or fewer`)
  }
  return name
}
