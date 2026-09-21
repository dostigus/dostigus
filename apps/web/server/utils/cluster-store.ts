import type { OpenedStore } from '@dostigus/db'
import process from 'node:process'
import { DEFAULT_STORE_URL, openStore, StoreError } from '@dostigus/db'

let opened: OpenedStore | undefined

export function useStore(): OpenedStore {
  if (!opened) {
    opened = openStore(process.env.DATABASE_URL ?? DEFAULT_STORE_URL)
  }
  return opened
}

export function closeStore(): void {
  opened?.close()
  opened = undefined
}

export function throwStoreError(error: unknown): never {
  if (error instanceof StoreError) {
    throw createError({
      statusCode: error.statusCode,
      statusMessage: error.message,
    })
  }
  throw error
}
