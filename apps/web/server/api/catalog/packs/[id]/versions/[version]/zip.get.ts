import { getPublishedListing, readCatalogMirror } from '@dostigus/catalog'
import { allowPublicCatalogCors } from '../../../../../../utils/catalog-cors'
import { catalogMirrorsDirOverride, withCatalogStore } from '../../../../../../utils/catalog-store'

export default defineEventHandler((event) => {
  allowPublicCatalogCors(event)
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  const version = decodeURIComponent(getRouterParam(event, 'version') ?? '')
  return withCatalogStore((store) => {
    const listing = getPublishedListing(store, id, version)
    if (!listing?.mirrorFilename) {
      throw createError({ statusCode: 404, statusMessage: 'Mirror zip not found' })
    }
    const bytes = readCatalogMirror(store, listing.mirrorFilename, catalogMirrorsDirOverride())
    setHeader(event, 'content-type', 'application/zip')
    setResponseHeader(event, 'content-length', bytes.byteLength)
    setHeader(event, 'content-disposition', `attachment; filename="${listing.mirrorFilename}"`)
    setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
    return bytes
  })
})
