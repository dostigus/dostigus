import { updateTask } from '@dostigus/db'
import { throwOwnerAuthError } from '../../utils/owner-auth'

type Body = {
  title?: string
  body?: string
  mode?: string
  grillPolicy?: string
  grillSkipReason?: string | null
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    return await withOwnerStore(event, (store) => ({
      task: updateTask(store, { kind: 'owner' }, id, body),
    }))
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
