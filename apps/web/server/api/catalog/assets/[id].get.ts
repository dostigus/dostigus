import { getCatalogAsset, readCatalogAssetBytes } from '@dostigus/catalog'
import { allowPublicCatalogCors } from '../../../utils/catalog-cors'
import { catalogAssetsDirOverride, withCatalogStore } from '../../../utils/catalog-store'

export default defineEventHandler((event) => {
  allowPublicCatalogCors(event)
  const id = getRouterParam(event, 'id') ?? ''
  return withCatalogStore((store) => {
    const asset = getCatalogAsset(store, id)
    if (!asset) {
      throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
    }
    const bytes = readCatalogAssetBytes(store, id, catalogAssetsDirOverride())
    setHeader(event, 'content-type', asset.mime)
    setHeader(event, 'content-length', String(bytes.byteLength))
    setHeader(event, 'content-disposition', `inline; filename="${asset.filename}"`)
    setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
    return bytes
  })
})
