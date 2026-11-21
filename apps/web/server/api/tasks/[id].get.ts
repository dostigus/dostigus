import { getTask } from '@dostigus/db'
import { throwOwnerAuthError } from '../../utils/owner-auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  try {
    return await withOwnerStore(event, (store) => ({
      task: getTask(store, { kind: 'owner' }, id),
    }))
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
