import type { MailEndpoint } from '@dostigus/db'
import type { HostHttpLookup } from './http-get'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { mailAllowlistAllows, normalizeMailHost, parseMailPort, StoreError } from '@dostigus/db'
import { isBlockedIpAddress } from './http-get'

/** One resolved IMAP or SMTP destination. Connect to `address`; verify TLS against `servername`. */
export type MailDestination = {
  host: string
  port: number
  address: string
  /** Null when the bound host is an IP literal. */
  servername: string | null
}

/**
 * Mail allowlist first, then DNS once, then the same loopback / private /
 * link-local block as Host HTTP get. The client connects to the checked
 * address, so a second lookup cannot rebind it. See ADR 0048.
 */
export async function resolveMailDestination(
  endpoint: MailEndpoint,
  allowlist: readonly string[],
  lookupFn: HostHttpLookup = dnsLookup,
): Promise<MailDestination> {
  const host = normalizeMailHost(endpoint.host)
  const port = parseMailPort(endpoint.port)
  if (!host || port == null) {
    throw new StoreError('Mail host is invalid', 400)
  }
  if (!mailAllowlistAllows(host, port, allowlist)) {
    throw new StoreError(`${host}:${port} is not on the mail allowlist`, 403)
  }
  let addresses: string[]
  if (isIP(host)) {
    addresses = [host]
  } else {
    try {
      const result = await lookupFn(host, { all: true })
      addresses = (Array.isArray(result) ? result : [result]).map((row) => row.address)
    } catch {
      throw new StoreError('Mail host could not be resolved', 400)
    }
  }
  if (addresses.length === 0 || addresses.some((address) => isBlockedIpAddress(address))) {
    throw new StoreError('blocked destination', 403)
  }
  return {
    host,
    port,
    address: addresses[0]!,
    servername: isIP(host) ? null : host,
  }
}
