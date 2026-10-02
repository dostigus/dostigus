import { seedCatalogFixtures, toCatalogPackPublic } from '@dostigus/catalog'
import { requireCatalogPublisher } from '../../utils/catalog-auth'
import { catalogMirrorsDirOverride, withCatalogStore } from '../../utils/catalog-store'
import { catalogPublicOrigin } from '../../utils/env'

export default defineEventHandler((event) => {
  requireCatalogPublisher(event)
  return withCatalogStore((store) => {
    const listings = seedCatalogFixtures(store, { mirrors: catalogMirrorsDirOverride() })
    const origin = catalogPublicOrigin()
    return {
      packs: listings
        .filter((listing) => listing.status === 'published')
        .map((listing) => toCatalogPackPublic(listing, origin)),
    }
  })
})
