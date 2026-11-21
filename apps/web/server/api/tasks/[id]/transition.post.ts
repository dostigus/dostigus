import { transitionTask } from '@dostigus/db'
import { throwOwnerAuthError } from '../../../utils/owner-auth'

type Body = { status?: string }

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    return await withOwnerStore(event, (store) => ({
      task: transitionTask(store, { kind: 'owner' }, id, body.status ?? ''),
    }))
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
