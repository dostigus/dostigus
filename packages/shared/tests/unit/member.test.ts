import { expect, it } from 'vitest'
import { ownerDisplayName, parseMemberDisplayName } from '../../src/index'

it('parses a Member display name', () => {
  expect(parseMemberDisplayName('  Ada Lovelace  ')).toBe('Ada Lovelace')
  expect(() => parseMemberDisplayName('   ')).toThrow(/Display name is required/)
  expect(() => parseMemberDisplayName('a'.repeat(65))).toThrow(/64 characters or fewer/)
})

it('uses the Owner login when Chat needs a name', () => {
  expect(ownerDisplayName({ username: 'nick', email: 'nick@example.test' })).toBe('nick')
  expect(ownerDisplayName({ username: null, email: 'nick@example.test' })).toBe('nick@example.test')
  expect(ownerDisplayName({ username: null, email: null })).toBe('Owner')
})
