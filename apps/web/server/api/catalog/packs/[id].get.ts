import { getPublishedListing, toCatalogPackPublic } from '@dostigus/catalog'
import { allowPublicCatalogCors } from '../../../utils/catalog-cors'
import { withCatalogStore } from '../../../utils/catalog-store'
import { catalogPublicOrigin } from '../../../utils/env'

export default defineEventHandler((event) => {
  allowPublicCatalogCors(event)
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  return withCatalogStore((store) => {
    const listing = getPublishedListing(store, id)
    if (!listing) {
      throw createError({ statusCode: 404, statusMessage: 'Pack not found' })
    }
    return { pack: toCatalogPackPublic(listing, catalogPublicOrigin()) }
  })
})
