import { afterEach, expect, it } from 'vitest'
import { CatalogError } from '../../src/catalog-error'
import {
  catalogAssetPublicPath,
  catalogMirrorFilename,
  putCatalogAssetBytes,
  readCatalogAssetBytes,
  writeCatalogMirror,
} from '../../src/mirror'
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

it('names the mirror {id}-{version}.zip', () => {
  expect(catalogMirrorFilename('dostigus.kitchen', '1.0.0')).toBe('dostigus.kitchen-1.0.0.zip')
})

it('refuses overwrite of a written mirror', () => {
  const store = memoryStore()
  const bytes = new Uint8Array([0x50, 0x4B, 0x03, 0x04])
  writeCatalogMirror(store, 'dostigus.kitchen', '1.0.0', bytes)
  expect(() => writeCatalogMirror(store, 'dostigus.kitchen', '1.0.0', bytes)).toThrow(CatalogError)
})

it('stores a listing asset off the Pack zip', () => {
  const store = memoryStore()
  const asset = putCatalogAssetBytes(store, {
    filename: 'kitchen.png',
    mime: 'image/png',
    bytes: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
  })
  expect(catalogAssetPublicPath(asset.id)).toBe(`/api/catalog/assets/${asset.id}`)
  expect(readCatalogAssetBytes(store, asset.id)[0]).toBe(0x89)
})
