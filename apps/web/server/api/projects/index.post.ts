import { createProject } from '@dostigus/db'
import { throwOwnerAuthError } from '../../utils/owner-auth'

type Body = { name?: string, slug?: string, previewUrl?: string }

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    const project = await withOwnerStore(event, (store) => createProject(store, { kind: 'owner' }, {
      name: body.name ?? '',
      slug: body.slug,
      previewUrl: body.previewUrl,
    }))
    setResponseStatus(event, 201)
    return { project }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
