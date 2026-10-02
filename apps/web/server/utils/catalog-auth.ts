import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import { catalogPublishToken } from './env'
import { readAuthorizationHeader } from './mcp-auth'

function tokensEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) {
    return false
  }
  return timingSafeEqual(a, b)
}

/**
 * Nick publish v1. Not Cluster Owner / Admin.
 * Empty expected token leaves publish disabled (403).
 */
export function requireCatalogPublisher(event: unknown): void {
  const expected = catalogPublishToken()
  if (!expected) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Catalog publish is disabled',
    })
  }
  const header = readAuthorizationHeader(event) || ''
  if (!header.startsWith('Bearer ') || !tokensEqual(header.slice(7), expected)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Catalog publish token required',
    })
  }
}
