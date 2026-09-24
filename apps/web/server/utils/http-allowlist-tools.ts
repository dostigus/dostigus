import type { OpenedStore } from '@dostigus/db'
import type { BotViewer } from '@dostigus/shared'
import type { ScheduleToolContext } from './schedule-tools'
import { getClusterHttpAllowlist, setClusterHttpAllowlist, StoreError } from '@dostigus/db'
import { hostHttpGet } from './http-get'

export function clusterHttpAllowlistGet(store: OpenedStore) {
  return { hosts: getClusterHttpAllowlist(store) }
}

export function clusterHttpAllowlistSet(
  store: OpenedStore,
  input: Record<string, unknown>,
  viewer?: BotViewer,
) {
  if (viewer && viewer.role !== 'owner') {
    throw new StoreError('Only the Owner can change this', 403)
  }
  return { hosts: setClusterHttpAllowlist(store, input.hosts) }
}

export async function clusterHttpGet(
  store: OpenedStore,
  input: Record<string, unknown>,
  ctx?: ScheduleToolContext,
) {
  return hostHttpGet(input.url, {
    allowlist: getClusterHttpAllowlist(store),
    fetchImpl: ctx?.fetchImpl,
    lookup: ctx?.lookup,
    env: ctx?.env,
  })
}
