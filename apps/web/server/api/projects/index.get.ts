import { listProjects } from '@dostigus/db'
import { throwOwnerAuthError } from '../../utils/owner-auth'

export default defineEventHandler(async (event) => {
  try {
    return await withOwnerStore(event, (store) => ({
      projects: listProjects(store, { kind: 'owner' }),
    }))
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
