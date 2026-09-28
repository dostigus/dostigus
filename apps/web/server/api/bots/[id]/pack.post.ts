import { Buffer } from 'node:buffer'
import { viewerFromUser } from '../../../utils/cluster-bots'
import { exportClusterPack } from '../../../utils/cluster-packs'
import { resolveEventLocale } from '../../../utils/host-locale'

type ExportBody = {
  botSlug?: string
  version?: string
  readme?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const body = await readBody<ExportBody>(event).catch(() => ({} as ExportBody))
  try {
    const locale = await resolveEventLocale(event)
    const exported = withClusterStore((store) => exportClusterPack(
      store,
      getRouterParam(event, 'id') ?? '',
      viewerFromUser(session.user),
      {
        botSlug: body.botSlug,
        version: body.version,
        readme: body.readme,
        locale,
      },
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
