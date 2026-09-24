import { contentDispositionFor, openArtifactStream } from '../../utils/artifacts'
import { viewerFromUser } from '../../utils/cluster-bots'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const viewer = viewerFromUser(session.user)
  const id = getRouterParam(event, 'id') ?? ''
  const query = getQuery(event)
  const download = query.download === '1' || query.download === 'true'
  try {
    const opened = await openArtifactStream(useStore(), id, viewer, { download })
    setHeader(event, 'content-type', opened.row.mime)
    setResponseHeader(event, 'content-length', opened.size)
    setHeader(event, 'content-disposition', contentDispositionFor(opened.row, opened.download))
    setHeader(event, 'cache-control', 'private, no-store')
    return sendStream(event, opened.stream)
  } catch (error) {
    throwStoreError(error)
  }
})
