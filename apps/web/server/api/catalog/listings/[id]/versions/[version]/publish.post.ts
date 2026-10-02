import { Buffer } from 'node:buffer'
import { publishCatalogListing, publishCatalogListingFromZip } from '@dostigus/catalog'
import { requireCatalogPublisher } from '../../../../../../utils/catalog-auth'
import { catalogMirrorsDirOverride, throwCatalogError, withCatalogStore } from '../../../../../../utils/catalog-store'

export default defineEventHandler(async (event) => {
  requireCatalogPublisher(event)
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  const version = decodeURIComponent(getRouterParam(event, 'version') ?? '')
  const type = getHeader(event, 'content-type') ?? ''
  try {
    let bytes: Uint8Array | undefined
    if (type.includes('multipart/form-data')) {
      const form = await readMultipartFormData(event).catch(() => null)
      const file = form?.find((part) => part.filename && part.data)
      if (file) {
        bytes = new Uint8Array(file.data)
      }
    } else {
      const body = await readBody<{ zipBase64?: string }>(event).catch(() => ({ zipBase64: undefined }))
      if (typeof body.zipBase64 === 'string' && body.zipBase64.trim()) {
        bytes = Uint8Array.from(Buffer.from(body.zipBase64, 'base64'))
      }
    }
    return withCatalogStore((store) => {
      const listing = bytes
        ? publishCatalogListingFromZip(store, id, version, bytes, { mirrors: catalogMirrorsDirOverride() })
        : publishCatalogListing(store, id, version, undefined, { mirrors: catalogMirrorsDirOverride() })
      return { listing }
    })
  } catch (error) {
    throwCatalogError(error)
  }
})
