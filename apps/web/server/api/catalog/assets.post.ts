import { catalogAssetPublicPath, putCatalogAssetBytes } from '@dostigus/catalog'
import { requireCatalogPublisher } from '../../utils/catalog-auth'
import { catalogAssetsDirOverride, throwCatalogError, withCatalogStore } from '../../utils/catalog-store'

export default defineEventHandler(async (event) => {
  requireCatalogPublisher(event)
  const type = getHeader(event, 'content-type') ?? ''
  try {
    if (!type.includes('multipart/form-data')) {
      throw createError({ statusCode: 400, statusMessage: 'Upload a listing asset' })
    }
    const form = await readMultipartFormData(event).catch(() => null)
    const file = form?.find((part) => part.filename && part.data)
    if (!file) {
      throw createError({ statusCode: 400, statusMessage: 'Upload a listing asset' })
    }
    return withCatalogStore((store) => {
      const asset = putCatalogAssetBytes(store, {
        filename: file.filename ?? 'asset',
        mime: file.type || 'application/octet-stream',
        bytes: new Uint8Array(file.data),
      }, catalogAssetsDirOverride())
      return {
        asset: {
          ...asset,
          href: catalogAssetPublicPath(asset.id),
        },
      }
    })
  } catch (error) {
    throwCatalogError(error)
  }
})
