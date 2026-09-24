import type { OpenedStore } from '@dostigus/db'
import { getTurn, listTurns, StoreError } from '@dostigus/db'

/**
 * Ops read of Host Bot turns. The bearer token sees every Cluster turn.
 * No per-person gate on day-1. See ADR 0029.
 */
export function turnsList(store: OpenedStore, input: Record<string, unknown>) {
  const limit = readLimit(input.limit)
  return {
    turns: listTurns(store, {
      botId: readFilter(input.botId),
      threadId: readFilter(input.threadId),
      since: readSince(input.since),
      limit,
    }),
  }
}

export function turnsGet(store: OpenedStore, input: Record<string, unknown>) {
  const id = typeof input.id === 'string' ? input.id.trim() : ''
  const turn = id ? getTurn(store, id) : undefined
  if (!turn) {
    throw new StoreError('Turn not found', 404)
  }
  return { turn }
}

function readFilter(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readSince(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }
  return undefined
}

function readLimit(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim())
  }
  return undefined
}
