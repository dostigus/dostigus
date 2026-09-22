import process from 'node:process'

/**
 * HEAD /preview-seed. Same gate and status as GET, without creating the
 * Owner, signing in, creating a Bot, or inserting Chat lines.
 * 204 when the gate is open and the stable Bot does not exist yet
 * (GET would create it). 302 when that Bot already exists.
 */
export default defineEventHandler((event) => {
  if (!previewSeedAllowed({
    dev: import.meta.dev,
    flag: process.env.DOSTIGUS_PREVIEW_SEED,
  })) {
    setResponseStatus(event, 404, 'Not found')
    return null
  }

  const head = readPreviewSeedHead(useStore())
  if (head.statusCode === 409) {
    setResponseStatus(event, 409, PREVIEW_SEED_OWNER_CONFLICT)
    return null
  }
  if (head.statusCode === 302 && head.location) {
    setResponseStatus(event, 302)
    setResponseHeader(event, 'location', head.location)
    return null
  }
  setResponseStatus(event, 204)
  return null
})
