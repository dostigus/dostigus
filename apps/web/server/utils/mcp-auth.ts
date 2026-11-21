import type { FactoryCaller } from '@dostigus/db'
import { AsyncLocalStorage } from 'node:async_hooks'

/** Runtime shape on Nitro h3 v1 events. Toolkit H3Event types stay opaque. */
type McpAuthContext = {
  context?: { agentOk?: boolean, mcpCaller?: FactoryCaller }
}

type HeaderEvent = {
  headers?: { get?: (name: string) => string | null, authorization?: string }
  node?: { req?: { headers?: Record<string, string | string[] | undefined> } }
  req?: { headers?: { get?: (name: string) => string | null } | Record<string, string | string[] | undefined> }
}

export function readAuthorizationHeader(event: unknown): string | undefined {
  const ev = event as HeaderEvent
  const fromGet = ev.headers?.get?.('authorization')
  if (fromGet) {
    return fromGet
  }
  if (typeof ev.headers?.authorization === 'string') {
    return ev.headers.authorization
  }
  const nodeAuth = ev.node?.req?.headers?.authorization
  if (typeof nodeAuth === 'string') {
    return nodeAuth
  }
  const reqHeaders = ev.req?.headers
  if (reqHeaders && typeof reqHeaders.get === 'function') {
    return reqHeaders.get('authorization') ?? undefined
  }
  if (reqHeaders && typeof reqHeaders === 'object' && 'authorization' in reqHeaders) {
    const value = reqHeaders.authorization
    return Array.isArray(value) ? value[0] : value
  }
  return undefined
}

/**
 * Soft Bearer auth (toolkit docs): never throw 401 — clients treat it as OAuth.
 * Valid token → event.context.agentOk; tools gate via `enabled`.
 * Empty expected token leaves tools disabled.
 */
export function authorizeMcpAgent(
  event: unknown,
  authorizationHeader: string | undefined,
  expectedToken: string,
): void {
  if (!expectedToken) {
    return
  }
  const header = authorizationHeader || ''
  if (!header.startsWith('Bearer ')) {
    return
  }
  if (header.slice(7) === expectedToken) {
    const ev = event as McpAuthContext
    ev.context ??= {}
    ev.context.agentOk = true
  }
}

export function mcpToolsEnabled(event: unknown): boolean {
  return !!(event as McpAuthContext).context?.agentOk
}

const mcpCallerStorage = new AsyncLocalStorage<FactoryCaller>()

export function bearerToken(authorizationHeader: string | undefined): string {
  const header = authorizationHeader || ''
  return header.startsWith('Bearer ') ? header.slice(7) : ''
}

export function setMcpCaller(event: unknown, caller: FactoryCaller): void {
  const ev = event as McpAuthContext
  ev.context ??= {}
  ev.context.mcpCaller = caller
  mcpCallerStorage.enterWith(caller)
}

export function runWithMcpCaller<T>(caller: FactoryCaller, fn: () => T): T {
  return mcpCallerStorage.run(caller, fn)
}

export function currentMcpCaller(): FactoryCaller | undefined {
  return mcpCallerStorage.getStore()
}

/** Factory tools. A Project token does not set agentOk. See ADR 0052. */
export function factoryToolsEnabled(event: unknown): boolean {
  const caller = (event as McpAuthContext).context?.mcpCaller
  return caller?.kind === 'owner' || caller?.kind === 'project'
}

export function activeFactoryCaller(): FactoryCaller {
  const fromStore = currentMcpCaller()
  if (fromStore) {
    return fromStore
  }
  try {
    const event = useEvent() as McpAuthContext
    const caller = event.context?.mcpCaller
    if (caller) {
      return caller
    }
  } catch {
    // Unit tests have no Nitro event. The caller is the async store.
  }
  throw new Error('MCP caller is missing')
}
