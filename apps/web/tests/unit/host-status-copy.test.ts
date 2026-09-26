import { tHost } from '@dostigus/ui-kit/locale'
import { expect, it } from 'vitest'
import { hostStatusCopy } from '../../app/utils/host-status-copy'

it('maps household API status messages onto the Locale dictionary', () => {
  const ru = (key: string) => tHost('ru', key)
  expect(hostStatusCopy(
    { statusMessage: 'Invalid email, username, or password' },
    ru,
    'auth.error.fallbackSignIn',
  )).toBe(tHost('ru', 'auth.error.invalidCredentials'))
  expect(hostStatusCopy(
    { statusMessage: 'Name this Thread' },
    ru,
    'host.threadCreate.createFailed',
  )).toBe(tHost('ru', 'host.threadCreate.nameThread'))
  expect(hostStatusCopy(
    { data: { statusMessage: 'Sign out, then open this link again' } },
    ru,
    'auth.error.fallbackJoin',
  )).toBe(tHost('ru', 'auth.error.signOutFirst'))
  expect(hostStatusCopy(undefined, ru, 'auth.error.fallbackSignIn'))
    .toBe(tHost('ru', 'auth.error.fallbackSignIn'))
  expect(hostStatusCopy(
    { statusMessage: 'A Store error without a dictionary key' },
    ru,
    'auth.error.fallbackSignIn',
  )).toBe('A Store error without a dictionary key')
})
