import { allowPublicCatalogCors } from '../../../utils/catalog-cors'

export default defineEventHandler((event) => {
  allowPublicCatalogCors(event)
  setResponseStatus(event, 204)
  return null
})
