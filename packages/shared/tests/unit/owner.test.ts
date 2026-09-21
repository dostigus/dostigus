import { expect, it } from 'vitest'
import { parseOwnerIdentifier, parseOwnerPassword } from '../../src/index'

it('parses an email or a username', () => {
  expect(parseOwnerIdentifier('Nick@Example.TEST')).toEqual({
    email: 'nick@example.test',
    username: null,
  })
  expect(parseOwnerIdentifier('Nick.Owner')).toEqual({
    email: null,
    username: 'nick.owner',
  })
})

it('rejects a blank identifier and a short password', () => {
  expect(() => parseOwnerIdentifier('')).toThrow(/required/)
  expect(() => parseOwnerPassword('short')).toThrow(/at least 8/)
  expect(parseOwnerPassword('long-enough')).toBe('long-enough')
})
