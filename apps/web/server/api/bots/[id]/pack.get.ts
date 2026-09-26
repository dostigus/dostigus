import { Buffer } from 'node:buffer'
import { viewerFromUser } from '../../../utils/cluster-bots'
import { exportClusterPack } from '../../../utils/cluster-packs'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  try {
    const exported = withClusterStore((store) => exportClusterPack(
      store,
      getRouterParam(event, 'id') ?? '',
      viewerFromUser(session.user),
    ))
    setHeader(event, 'content-type', 'application/zip')
    setHeader(event, 'content-disposition', `attachment; filename="${exported.filename}"`)
    setHeader(event, 'cache-control', 'private, no-store')
    setResponseHeader(event, 'content-length', exported.bytes.byteLength)
    return send(event, Buffer.from(exported.bytes))
  } catch (error) {
    throwStoreError(error)
  }
})
