import { createRepository, useDatabase } from '@dostigus/database'

export { useDatabase }

export function useRepository() {
  return createRepository(useDatabase())
}
