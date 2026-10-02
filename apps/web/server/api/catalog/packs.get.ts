import { listPublishedPacks, toCatalogPackPublic } from '@dostigus/catalog'
import { allowPublicCatalogCors } from '../../utils/catalog-cors'
import { withCatalogStore } from '../../utils/catalog-store'
import { catalogPublicOrigin } from '../../utils/env'

export default defineEventHandler((event) => {
  allowPublicCatalogCors(event)
  const origin = catalogPublicOrigin()
  return withCatalogStore((store) => ({
    packs: listPublishedPacks(store).map((listing) => toCatalogPackPublic(listing, origin)),
  }))
})
