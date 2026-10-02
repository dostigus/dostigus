import { afterEach, expect, it } from 'vitest'
import { CatalogError } from '../../src/catalog-error'
import { CATALOG_FIXTURES } from '../../src/fixtures'
import {
  getPublishedListing,
  listPublishedPacks,
  upsertDraftListing,
} from '../../src/listings'
import { catalogMirrorFilename, readCatalogMirror } from '../../src/mirror'
import { toCatalogPackPublic } from '../../src/public'
import { submitCatalogListing } from '../../src/publish'
import { seedCatalogFixtures } from '../../src/seed'
import { openCatalogStore } from '../../src/store'

const opened: Array<ReturnType<typeof openCatalogStore>> = []

function memoryStore() {
  const store = openCatalogStore('file::memory:')
  opened.push(store)
  return store
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

function draftWrite(over: Partial<Parameters<typeof upsertDraftListing>[1]> = {}) {
  return {
    packId: 'dostigus.kitchen',
    version: '1.0.0',
    author: 'Dostigus',
    authorLink: 'https://dostigus.ru',
    title: { en: 'Kitchen', ru: 'Kitchen' },
    short: { en: 'Dinner', ru: 'Ужин' },
    long: { en: 'Long EN', ru: 'Long RU' },
    screenshots: [],
    assets: [],
    originUrl: 'https://github.com/dostigus/cloud',
    sortOrder: 1,
    ...over,
  }
}

it('stores a draft listing off the Cluster Store', () => {
  const store = memoryStore()
  const listing = upsertDraftListing(store, draftWrite())
  expect(listing.status).toBe('draft')
  expect(listing.packId).toBe('dostigus.kitchen')
  expect(listing.mirrorFilename).toBeNull()
  expect(listPublishedPacks(store)).toEqual([])
})

it('publishes an immutable mirror zip and lists only published Packs', () => {
  const store = memoryStore()
  const fixture = CATALOG_FIXTURES[0]!
  const result = submitCatalogListing(store, {
    listing: fixture.listing,
    tree: fixture.tree,
    publish: true,
  })
  expect(result.listing.status).toBe('published')
  expect(result.listing.mirrorFilename).toBe('dostigus.kitchen-1.0.0.zip')
  const bytes = readCatalogMirror(store, result.listing.mirrorFilename!)
  expect(bytes[0]).toBe(0x50)
  expect(bytes[1]).toBe(0x4B)
  expect(catalogMirrorFilename('dostigus.kitchen', '1.0.0')).toBe('dostigus.kitchen-1.0.0.zip')
  const listed = listPublishedPacks(store)
  expect(listed.map((row) => row.packId)).toEqual(['dostigus.kitchen'])
  const publicPack = toCatalogPackPublic(listed[0]!, 'https://catalog.example')
  expect(publicPack.mirror.href).toBe(
    'https://catalog.example/api/catalog/packs/dostigus.kitchen/versions/1.0.0/zip',
  )
  expect(publicPack.status).toBe('published')
})

it('refuses a second publish of the same version', () => {
  const store = memoryStore()
  const fixture = CATALOG_FIXTURES[0]!
  submitCatalogListing(store, {
    listing: fixture.listing,
    tree: fixture.tree,
    publish: true,
  })
  expect(() => submitCatalogListing(store, {
    listing: fixture.listing,
    tree: fixture.tree,
    publish: true,
  })).toThrow(CatalogError)
  expect(() => upsertDraftListing(store, draftWrite())).toThrow(/immutable/)
})

it('rejects secrets in the Pack zip', () => {
  const store = memoryStore()
  const fixture = CATALOG_FIXTURES[0]!
  expect(() => submitCatalogListing(store, {
    listing: fixture.listing,
    tree: {
      ...fixture.tree,
      manifest: {
        ...fixture.tree.manifest,
        soul: `${fixture.tree.manifest.soul} OPENROUTER_API_KEY=sk-or-v1-not-a-real-key`,
      },
    },
    publish: true,
  })).toThrow(/secrets/)
})

it('returns the latest published version for get', () => {
  const store = memoryStore()
  const fixture = CATALOG_FIXTURES[1]!
  submitCatalogListing(store, {
    listing: fixture.listing,
    tree: fixture.tree,
    publish: true,
  })
  const next = {
    ...fixture.tree,
    manifest: { ...fixture.tree.manifest, version: '1.0.1' },
  }
  submitCatalogListing(store, {
    listing: { ...fixture.listing, sortOrder: 2 },
    tree: next,
    publish: true,
  })
  expect(getPublishedListing(store, 'dostigus.mail')?.version).toBe('1.0.1')
  expect(getPublishedListing(store, 'dostigus.mail', '1.0.0')?.version).toBe('1.0.0')
})

it('seeds Kitchen, Mail, and Reader once', () => {
  const store = memoryStore()
  const first = seedCatalogFixtures(store)
  const second = seedCatalogFixtures(store)
  expect(first.map((row) => row.packId)).toEqual([
    'dostigus.kitchen',
    'dostigus.mail',
    'dostigus.reader',
  ])
  expect(second.map((row) => row.publishedAt)).toEqual(first.map((row) => row.publishedAt))
  expect(listPublishedPacks(store)).toHaveLength(3)
})
