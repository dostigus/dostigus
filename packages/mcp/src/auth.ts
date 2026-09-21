import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import process from 'node:process'
import { trimOrUndefined } from '@dostigus/shared'

/** Cluster agent token. Either env enables the Host HTTP MCP endpoint. */
export const MCP_TOKEN_ENV = ['DOSTIGUS_MCP_TOKEN', 'NUXT_AGENT_TOKEN'] as const

export function readClusterMcpToken(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string | undefined {
  return trimOrUndefined(env.DOSTIGUS_MCP_TOKEN)
    ?? trimOrUndefined(env.NUXT_AGENT_TOKEN)
}

export type McpHttpAuth
  = | { ok: true }
    | { ok: false, status: 404, message: string }
    | { ok: false, status: 401, message: string }

function tokensEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) {
    return false
  }
  return timingSafeEqual(a, b)
}

export function bearerToken(authorization: string | undefined): string | undefined {
  const value = authorization?.trim() ?? ''
  if (!value.toLowerCase().startsWith('bearer ')) {
    return undefined
  }
  return trimOrUndefined(value.slice('bearer '.length))
}

/**
 * HTTP MCP gate: unset Cluster token → endpoint off (404).
 * Set but missing/wrong Authorization → 401.
 */
export function authorizeMcpHttp(input: {
  expectedToken?: string
  authorization?: string
}): McpHttpAuth {
  const expected = trimOrUndefined(input.expectedToken)
  if (!expected) {
    return { ok: false, status: 404, message: 'MCP surface is disabled' }
  }
  const provided = bearerToken(input.authorization)
  if (!provided || !tokensEqual(provided, expected)) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }
  return { ok: true }
}
