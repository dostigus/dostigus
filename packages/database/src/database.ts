import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import * as tables from './tables'

export type Database = NodePgDatabase<typeof tables>

let instance: Database | null = null

export function useCreateDatabase(url: string) {
  const pool = new pg.Pool({ connectionString: url })
  instance = drizzle({ client: pool, schema: tables })
}

export async function useMigrateDatabase(migrationsFolder: string) {
  if (!instance) {
    throw new Error('Database is not created')
  }

  await migrate(instance, {
    migrationsFolder: resolve(migrationsFolder),
  })
}

export function useDatabase(): Database {
  if (!instance) {
    throw new Error('Database is not created')
  }

  return instance
}
