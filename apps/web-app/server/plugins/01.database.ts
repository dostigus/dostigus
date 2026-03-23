import { createRepository, useCreateDatabase, useMigrateDatabase } from '@dostigus/database'

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

  await seed(logger)
})

async function seed(logger: ReturnType<typeof useLogger>) {
  const { user } = createRepository(useDatabase())

  const existing = await user.findByEmail('goose@dostigus.ru')
  if (existing) {
    return
  }

  await user.create({
    email: 'goose@dostigus.ru',
    name: 'Гусь-достигатор',
  })

  logger.success('Seed user created')
}
