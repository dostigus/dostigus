import { updateProject } from '@dostigus/db'
import { throwOwnerAuthError } from '../../utils/owner-auth'

type Body = {
  name?: string
  previewUrl?: string | null
  status?: string
  architectMode?: string
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    return await withOwnerStore(event, (store) => ({
      project: updateProject(store, { kind: 'owner' }, id, body),
    }))
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
