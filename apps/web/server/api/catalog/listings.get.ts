import { listListings } from '@dostigus/catalog'
import { requireCatalogPublisher } from '../../utils/catalog-auth'
import { withCatalogStore } from '../../utils/catalog-store'

export default defineEventHandler((event) => {
  requireCatalogPublisher(event)
  return withCatalogStore((store) => ({ listings: listListings(store) }))
})
