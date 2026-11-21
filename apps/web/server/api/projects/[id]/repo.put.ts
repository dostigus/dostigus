import { linkRepo } from '@dostigus/db'
import { throwOwnerAuthError } from '../../../utils/owner-auth'

type Body = {
  fullName?: string
  defaultBranch?: string
  docsLayout?: { adrs?: string, specs?: string, glossary?: string }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    return await withOwnerStore(event, (store) => ({
      project: linkRepo(store, { kind: 'owner' }, id, {
        fullName: body.fullName ?? '',
        defaultBranch: body.defaultBranch,
        docsLayout: body.docsLayout,
      }),
    }))
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
