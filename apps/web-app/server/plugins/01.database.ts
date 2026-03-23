import { useCreateDatabase, useMigrateDatabase } from '@dostigus/database'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()

  if (!config.databaseUrl) {
    throw new Error('databaseUrl is not defined')
  }

  const logger = useLogger('database')

  useCreateDatabase(config.databaseUrl)

  const migrationsPath = import.meta.dev
    ? '../../packages/database/migrations'
    : './migrations'

  try {
    await useMigrateDatabase(migrationsPath)
    logger.success('Database migrated')
  } catch (error) {
    logger.warn('Migration warning (may be already applied):', error)
  }
})
