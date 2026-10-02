import { packTreeToZip, parsePackTreeJson } from '@dostigus/shared'
import { submitCatalogListing } from '@dostigus/catalog'
import { requireCatalogPublisher } from '../../utils/catalog-auth'
import { catalogMirrorsDirOverride, throwCatalogError, withCatalogStore } from '../../utils/catalog-store'

type ListingBody = {
  listing?: Record<string, unknown>
  author?: unknown
  authorLink?: unknown
  title?: unknown
  short?: unknown
  long?: unknown
  screenshots?: unknown
  assets?: unknown
  originUrl?: unknown
  sortOrder?: unknown
  publish?: unknown
  pack?: unknown
  zipBase64?: unknown
}

function listingFromBody(body: ListingBody) {
  if (body.listing && typeof body.listing === 'object') {
    return body.listing
  }
  return {
    author: body.author,
    authorLink: body.authorLink,
    title: body.title,
    short: body.short,
    long: body.long,
    screenshots: body.screenshots,
    assets: body.assets,
    originUrl: body.originUrl,
    sortOrder: body.sortOrder,
  }
}

export default defineEventHandler(async (event) => {
  requireCatalogPublisher(event)
  const type = getHeader(event, 'content-type') ?? ''
  try {
    if (type.includes('multipart/form-data')) {
      const form = await readMultipartFormData(event).catch(() => null)
      if (!form || form.length === 0) {
        throw createError({ statusCode: 400, statusMessage: 'Pack zip is required' })
      }
      const field = (name: string) => {
        const part = form.find((item) => item.name === name && !item.filename)
        return part?.data ? part.data.toString('utf8') : ''
      }
      const listingRaw = field('listing')
      let listingField: Record<string, unknown> | undefined
      if (listingRaw) {
        try {
          listingField = JSON.parse(listingRaw) as Record<string, unknown>
        } catch {
          throw createError({ statusCode: 400, statusMessage: 'listing must be JSON' })
        }
      }
      const listing = listingField
        ? listingFromBody({ listing: listingField })
        : listingFromBody({
          author: field('author'),
          authorLink: field('authorLink'),
          title: field('title'),
          short: field('short'),
          long: field('long'),
          originUrl: field('originUrl'),
          sortOrder: field('sortOrder'),
        })
      const file = form.find((part) => part.filename && part.data)
      if (!file) {
        throw createError({ statusCode: 400, statusMessage: 'Pack zip is required' })
      }
      return withCatalogStore((store) => {
        const result = submitCatalogListing(store, {
          listing,
          bytes: new Uint8Array(file.data),
          publish: field('publish') === '1' || field('publish') === 'true',
        }, { mirrors: catalogMirrorsDirOverride() })
        return { listing: result.listing }
      })
    }

    const body = await readBody<ListingBody>(event).catch(() => ({} as ListingBody))
    const listing = listingFromBody(body)
    let bytes: Uint8Array | undefined
    let tree
    if (typeof body.zipBase64 === 'string' && body.zipBase64.trim()) {
      bytes = Uint8Array.from(Buffer.from(body.zipBase64, 'base64'))
    } else if (body.pack != null) {
      tree = parsePackTreeJson(body.pack)
      bytes = packTreeToZip(tree)
    }
    if (!bytes) {
      throw createError({ statusCode: 400, statusMessage: 'Pack zip is required' })
    }
    return withCatalogStore((store) => {
      const result = submitCatalogListing(store, {
        listing,
        bytes,
        tree,
        publish: body.publish === true || body.publish === '1' || body.publish === 'true',
      }, { mirrors: catalogMirrorsDirOverride() })
      return { listing: result.listing }
    })
  } catch (error) {
    throwCatalogError(error)
  }
})
