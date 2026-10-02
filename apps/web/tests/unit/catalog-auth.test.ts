import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { catalogPublishToken } from '../../server/utils/env'

it('does not treat Cluster Admin as the Catalog Store publisher', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../server/utils/catalog-auth.ts'),
    'utf8',
  )
  expect(src).toContain('timingSafeEqual')
  expect(src).toContain('catalogPublishToken')
  expect(src).not.toContain('requireOwnerSession')
  expect(src).not.toContain('requireOwnerOrAdminSession')
  expect(src).not.toContain('memberIsAdmin')
  expect(catalogPublishToken({})).toBe('')
})
