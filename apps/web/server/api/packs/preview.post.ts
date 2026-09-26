import { viewerFromUser } from '../../utils/cluster-bots'
import { packApplyTargetFromBody, packTreeFromBody, packTreeFromUpload, previewClusterPack } from '../../utils/cluster-packs'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const viewer = viewerFromUser(session.user)
  const type = getHeader(event, 'content-type') ?? ''
  try {
    let tree
    let target = packApplyTargetFromBody()
    if (type.includes('multipart/form-data')) {
      const form = await readMultipartFormData(event).catch(() => null)
      if (!form || form.length === 0) {
        throw createError({ statusCode: 400, statusMessage: 'Pack file is required' })
      }
      const field = (name: string) => {
        const part = form.find((item) => item.name === name && !item.filename)
        return part?.data ? part.data.toString('utf8') : ''
      }
      target = packApplyTargetFromBody({
        target: field('target'),
        botId: field('botId'),
      })
      const uploads = form.filter((part) => part.filename && part.data)
      if (uploads.length === 0) {
        throw createError({ statusCode: 400, statusMessage: 'Pack file is required' })
      }
      if (uploads.length === 1) {
        const file = uploads[0]!
        tree = packTreeFromUpload({
          bytes: new Uint8Array(file.data),
          filename: file.filename,
        })
      } else {
        const files: Record<string, string> = {}
        for (const file of uploads) {
          const path = file.filename?.replaceAll('\\', '/') ?? ''
          if (path) {
            files[path] = file.data.toString('utf8')
          }
        }
        tree = packTreeFromUpload({ files })
      }
    } else {
      const body = await readBody<{
        pack?: unknown
        target?: string
        botId?: string
      }>(event).catch(() => ({ pack: undefined, target: undefined, botId: undefined }))
      tree = packTreeFromBody(body.pack)
      target = packApplyTargetFromBody(body)
    }
    return withClusterStore((store) => previewClusterPack(store, tree, target, viewer))
  } catch (error) {
    throwStoreError(error)
  }
})
