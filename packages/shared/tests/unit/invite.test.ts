import { parseInviteEmail } from '@dostigus/shared'
import { expect, it } from 'vitest'

it('normalizes an Invite email and rejects a username', () => {
  expect(parseInviteEmail('  Ada@Example.test ')).toBe('ada@example.test')
  expect(() => parseInviteEmail('ada')).toThrow(/valid email/)
  expect(() => parseInviteEmail('')).toThrow(/valid email/)
  expect(() => parseInviteEmail('not an email')).toThrow(/valid email/)
})
