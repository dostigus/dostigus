import { expect, it } from 'vitest'
import {
  parseArtifactIds,
  resolveArtifactMime,
  sniffArtifactMime,
  withArtifactLlmContent,
} from '../../src/index'

function bytes(...values: number[]) {
  return Uint8Array.from(values)
}

const png = bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00)
const jpeg = bytes(0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10)
const pdf = bytes(0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37)
const text = new TextEncoder().encode('hello notes')

it('sniffs image, pdf, and text magic bytes', () => {
  expect(sniffArtifactMime(png)).toBe('image/png')
  expect(sniffArtifactMime(jpeg)).toBe('image/jpeg')
  expect(sniffArtifactMime(pdf)).toBe('application/pdf')
  expect(sniffArtifactMime(text)).toBe('text/plain')
  expect(sniffArtifactMime(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull()
})

it('rejects a claimed type that does not match the sniff', () => {
  expect(() => resolveArtifactMime(jpeg, 'image/png')).toThrow(/does not match/)
  expect(() => resolveArtifactMime(pdf, 'text/plain')).toThrow(/does not match/)
  expect(() => resolveArtifactMime(text, 'image/jpeg')).toThrow(/does not match/)
  expect(resolveArtifactMime(text, 'text/markdown')).toBe('text/markdown')
  expect(resolveArtifactMime(png, 'image/png')).toBe('image/png')
})

it('caps artifactIds at three unique ids', () => {
  expect(parseArtifactIds(['a', 'b', 'a', 'c', 'd'])).toEqual(['a', 'b', 'c'])
  expect(parseArtifactIds(undefined)).toEqual([])
})

it('adds a short Artifact note and optional extract to LLM content', () => {
  const note = withArtifactLlmContent('Hi', [{
    id: 'a1',
    filename: 'notes.md',
    mime: 'text/markdown',
    byteSize: 12,
  }], 'keep it short')
  expect(note).toContain('Hi')
  expect(note).toContain('notes.md')
  expect(note).toContain('a1')
  expect(note).toContain('keep it short')
})
