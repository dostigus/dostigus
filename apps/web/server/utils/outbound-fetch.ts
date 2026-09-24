import type { Dispatcher } from 'undici'
import process from 'node:process'
import { Agent, ProxyAgent, fetch as undiciFetch } from 'undici'

export type ParsedOutboundProxy
  = | { kind: 'unset' }
    | { kind: 'proxy', href: string, hostname: string }
    | { kind: 'invalid' }

function trimmedEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]
  if (value == null) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * A usable proxy URL is http or https with a hostname.
 * Unset or empty after trim is direct. SOCKS is not day-1.
 */
export function parseOutboundProxyUrl(value: string | undefined | null): ParsedOutboundProxy {
  if (value == null) {
    return { kind: 'unset' }
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return { kind: 'unset' }
  }
  try {
    const parsed = new URL(trimmed)
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && parsed.hostname
    ) {
      return { kind: 'proxy', href: parsed.href, hostname: parsed.hostname }
    }
  } catch {
    // invalid
  }
  return { kind: 'invalid' }
}

/** LLM path: HTTPS_PROXY on https targets, else HTTP_PROXY. Never DOSTIGUS_HTTP_PROXY. */
export function resolveLlmOutboundProxy(
  targetUrl: string,
  env: NodeJS.ProcessEnv,
): ParsedOutboundProxy {
  let chosen: string | undefined
  try {
    const target = new URL(targetUrl)
    if (target.protocol === 'https:') {
      chosen = trimmedEnv(env, 'HTTPS_PROXY') ?? trimmedEnv(env, 'HTTP_PROXY')
    } else if (target.protocol === 'http:') {
      chosen = trimmedEnv(env, 'HTTP_PROXY')
    }
  } catch {
    chosen = trimmedEnv(env, 'HTTPS_PROXY') ?? trimmedEnv(env, 'HTTP_PROXY')
  }
  return parseOutboundProxyUrl(chosen)
}

/** Bot HTTP egress: DOSTIGUS_HTTP_PROXY only. Never HTTPS_PROXY / HTTP_PROXY. */
export function resolveBotHttpOutboundProxy(env: NodeJS.ProcessEnv): ParsedOutboundProxy {
  return parseOutboundProxyUrl(trimmedEnv(env, 'DOSTIGUS_HTTP_PROXY'))
}

export function createOutboundDispatcher(proxyHref: string | null): Dispatcher {
  return proxyHref ? new ProxyAgent(proxyHref) : new Agent()
}

export function dispatcherFromParsed(parsed: ParsedOutboundProxy): Dispatcher {
  if (parsed.kind === 'invalid') {
    throw new Error('outbound proxy URL is invalid')
  }
  return createOutboundDispatcher(parsed.kind === 'proxy' ? parsed.href : null)
}

/** Host-owned fetch. Always pass an explicit Agent or ProxyAgent. */
export const undiciOutboundFetch = ((input, init) =>
  undiciFetch(
    input as Parameters<typeof undiciFetch>[0],
    init as Parameters<typeof undiciFetch>[1],
  ) as Promise<Response>) as typeof fetch

export function attachOutboundDispatcher(
  fetchImpl: typeof fetch,
  dispatcher: Dispatcher,
): typeof fetch {
  return ((input, init) =>
    fetchImpl(input, { ...init, dispatcher } as RequestInit)) as typeof fetch
}

export function formatOutboundProxyLog(label: string, parsed: ParsedOutboundProxy): string {
  if (parsed.kind === 'unset') {
    return `${label}: unset`
  }
  if (parsed.kind === 'invalid') {
    return `${label}: invalid`
  }
  return `${label}: set (${parsed.hostname})`
}

export function warnIfNodeUseEnvProxy(
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = console.warn,
): void {
  const value = env.NODE_USE_ENV_PROXY
  if (value == null || value.trim() === '') {
    return
  }
  warn('NODE_USE_ENV_PROXY is set; it is ignored for Host-owned fetch')
}

export function logClusterOutboundProxies(
  env: NodeJS.ProcessEnv = process.env,
  log: (message: string) => void = console.warn,
): void {
  const https = parseOutboundProxyUrl(trimmedEnv(env, 'HTTPS_PROXY'))
  const http = parseOutboundProxyUrl(trimmedEnv(env, 'HTTP_PROXY'))
  const llm = https.kind !== 'unset' ? https : http
  log(formatOutboundProxyLog('Cluster outbound LLM proxy', llm))
  log(formatOutboundProxyLog('Cluster outbound Bot HTTP proxy', resolveBotHttpOutboundProxy(env)))
}
