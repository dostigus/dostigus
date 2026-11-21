import { createTask } from '@dostigus/db'
import { throwOwnerAuthError } from '../../../utils/owner-auth'

type Body = { title?: string, body?: string, mode?: string }

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    const task = await withOwnerStore(event, (store) => createTask(store, { kind: 'owner' }, id, {
      title: body.title ?? '',
      body: body.body,
      mode: body.mode ?? '',
    }))
    setResponseStatus(event, 201)
    return { task }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
