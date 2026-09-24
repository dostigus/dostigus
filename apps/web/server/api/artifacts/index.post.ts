import { putArtifactBytes } from '../../utils/artifacts'
import { viewerFromUser } from '../../utils/cluster-bots'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const viewer = viewerFromUser(session.user)
  const form = await readMultipartFormData(event).catch(() => null)
  if (!form || form.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Artifact file is required' })
  }
  let file = form.find((part) => part.name === 'file' && part.data)
  if (!file) {
    file = form.find((part) => part.filename && part.data)
  }
  if (!file?.data) {
    throw createError({ statusCode: 400, statusMessage: 'Artifact file is required' })
  }
  const field = (name: string) => {
    const part = form.find((item) => item.name === name && !item.filename)
    return part?.data ? part.data.toString('utf8') : ''
  }
  try {
    const artifact = putArtifactBytes(useStore(), {
      bytes: new Uint8Array(file.data),
      filename: file.filename ?? field('filename'),
      mime: file.type ?? field('mime'),
      actorPersonId: viewer.id,
      uploadId: field('uploadId'),
      claimedHash: field('hash') || field('contentHash'),
    })
    return { artifact }
  } catch (error) {
    throwStoreError(error)
  }
})
