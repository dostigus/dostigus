import { expect, it } from 'vitest'
import { memberErrorField } from '../../app/utils/member-form'

it('puts Add Member API errors under the field they name', () => {
  expect(memberErrorField({ data: { statusMessage: 'Display name is required' } })).toBe('displayName')
  expect(memberErrorField({ statusMessage: 'That email or username is already on this Host' })).toBe('login')
  expect(memberErrorField({ statusMessage: 'Username must be at least 2 characters' })).toBe('login')
  expect(memberErrorField({ statusMessage: 'Password must be at least 8 characters' })).toBe('password')
})

it('keeps errors that name no single field at the form', () => {
  expect(memberErrorField({ statusMessage: 'Check the Member details' })).toBe('form')
  expect(memberErrorField({ statusMessage: 'Owner session required' })).toBe('form')
  expect(memberErrorField(new Error('network'))).toBe('form')
  expect(memberErrorField(undefined)).toBe('form')
})

it('keeps an error at the form when its field is not on that form', () => {
  const displayName = { statusMessage: 'Display name is required' }
  const password = { statusMessage: 'Password must be at least 8 characters' }
  expect(memberErrorField(displayName, ['login', 'password'])).toBe('form')
  expect(memberErrorField(password, ['login', 'password'])).toBe('password')
  expect(memberErrorField({ statusMessage: 'Username must be at least 2 characters' }, ['displayName', 'password'])).toBe('form')
})
