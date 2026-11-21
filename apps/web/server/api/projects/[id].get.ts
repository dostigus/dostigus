import { listProjectTokens, listTasks, projectForCaller } from '@dostigus/db'
import { throwOwnerAuthError } from '../../utils/owner-auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  try {
    return await withOwnerStore(event, (store) => {
      const caller = { kind: 'owner' as const }
      return {
        project: projectForCaller(store, caller, id),
        tasks: listTasks(store, caller, id),
        tokens: listProjectTokens(store, id),
      }
    })
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
