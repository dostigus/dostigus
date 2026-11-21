import { attachTaskArtifact } from '@dostigus/db'
import { throwOwnerAuthError } from '../../../utils/owner-auth'

type Body = { artifactId?: string }

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    return await withOwnerStore(event, (store) => ({
      task: attachTaskArtifact(store, { kind: 'owner' }, id, body.artifactId ?? ''),
    }))
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
