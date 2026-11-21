import { issueProjectToken } from '@dostigus/db'
import { throwOwnerAuthError } from '../../../utils/owner-auth'

type Body = { label?: string }

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    const token = await withOwnerStore(event, (store) => issueProjectToken(store, id, body.label ?? ''))
    setResponseStatus(event, 201)
    return { token }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
