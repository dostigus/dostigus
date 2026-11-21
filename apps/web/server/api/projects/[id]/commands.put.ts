import { setCommands } from '@dostigus/db'
import { throwOwnerAuthError } from '../../../utils/owner-auth'

type Body = {
  setup?: string | null
  lint?: string | null
  test?: string | null
  check?: string | null
  run?: string | null
  preview?: string | null
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    return await withOwnerStore(event, (store) => ({
      project: setCommands(store, { kind: 'owner' }, id, body),
    }))
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
