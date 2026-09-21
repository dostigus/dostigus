import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'

const DEFAULT_STORE_URL = 'file:/var/lib/dostigus/cluster.sqlite'

function storeFilePath(databaseUrl: string): string {
  return databaseUrl.startsWith('file:')
    ? databaseUrl.slice('file:'.length)
    : databaseUrl
}

/** Ensure the Cluster Store directory exists (SQLite file lives on the compose volume). */
export default defineNitroPlugin(() => {
  const url = process.env.DATABASE_URL ?? DEFAULT_STORE_URL
  mkdirSync(dirname(storeFilePath(url)), { recursive: true })
})
