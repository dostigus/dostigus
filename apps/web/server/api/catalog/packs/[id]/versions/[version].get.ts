import { getPublishedListing, listPublishedVersions, toCatalogPackPublic } from '@dostigus/catalog'
import { allowPublicCatalogCors } from '../../../../../utils/catalog-cors'
import { withCatalogStore } from '../../../../../utils/catalog-store'
import { catalogPublicOrigin } from '../../../../../utils/env'

export default defineEventHandler((event) => {
  allowPublicCatalogCors(event)
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  const version = decodeURIComponent(getRouterParam(event, 'version') ?? '')
  const origin = catalogPublicOrigin()
  return withCatalogStore((store) => {
    if (version === 'latest') {
      const listing = getPublishedListing(store, id)
      if (!listing) {
        throw createError({ statusCode: 404, statusMessage: 'Pack not found' })
      }
      return { pack: toCatalogPackPublic(listing, origin) }
    }
    const listing = getPublishedListing(store, id, version)
    if (!listing) {
      throw createError({ statusCode: 404, statusMessage: 'Pack version not found' })
    }
    return {
      pack: toCatalogPackPublic(listing, origin),
      versions: listPublishedVersions(store, id).map((row) => row.version),
    }
  })
})
