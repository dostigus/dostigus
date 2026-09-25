import type { Artifact } from '@dostigus/shared'
import { VISION_JPEG_MIME, VISION_WIRE_MAX_BYTES } from '@dostigus/shared'
import { expect, it } from 'vitest'
import {
  buildVisionImageParts,
  encodeVisionJpeg,
  visionImagePartFromJpeg,
} from '../../server/utils/artifact-vision'

const PNG_1X1 = Uint8Array.from([
  0x89,
  0x50,
  0x4E,
  0x47,
  0x0D,
  0x0A,
  0x1A,
  0x0A,
  0x00,
  0x00,
  0x00,
  0x0D,
  0x49,
  0x48,
  0x44,
  0x52,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01,
  0x08,
  0x02,
  0x00,
  0x00,
  0x00,
  0x90,
  0x77,
  0x53,
  0xDE,
  0x00,
  0x00,
  0x00,
  0x0A,
  0x49,
  0x44,
  0x41,
  0x54,
  0x78,
  0x9C,
  0x63,
  0x00,
  0x01,
  0x00,
  0x00,
  0x05,
  0x00,
  0x01,
  0x0D,
  0x0A,
  0x2D,
  0xB4,
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4E,
  0x44,
  0xAE,
  0x42,
  0x60,
  0x82,
])

function artifact(id: string, mime: string): Artifact {
  return {
    id,
    filename: `${id}.bin`,
    mime,
    byteSize: 12,
    createdAt: new Date().toISOString(),
  }
}

it('encodes vision wire as JPEG and keeps the original bytes untouched', async () => {
  const source = Uint8Array.from(PNG_1X1)
  const jpeg = await encodeVisionJpeg(source)
  expect(jpeg[0]).toBe(0xFF)
  expect(jpeg[1]).toBe(0xD8)
  expect(jpeg[2]).toBe(0xFF)
  expect(source).toEqual(PNG_1X1)
  const part = visionImagePartFromJpeg(jpeg)
  expect(part.type).toBe('image_url')
  expect(part.image_url.detail).toBe('auto')
  expect(part.image_url.url.startsWith(`data:${VISION_JPEG_MIME};base64,`)).toBe(true)
  expect(part.image_url.url).not.toContain('image/png')
})

it('drops one oversize or failed file and still visions the others', async () => {
  const ok = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9])
  const parts = await buildVisionImageParts({
    artifacts: [
      artifact('big', 'image/jpeg'),
      artifact('bad', 'image/png'),
      artifact('ok', 'image/webp'),
      artifact('bmp', 'image/bmp'),
    ],
    readBytes: async (id) => {
      if (id === 'bad') {
        throw new Error('decode failed')
      }
      if (id === 'big') {
        return Uint8Array.from([0x01])
      }
      return ok
    },
    encode: async (bytes) => {
      if (bytes.byteLength === 1) {
        return new Uint8Array(VISION_WIRE_MAX_BYTES + 1)
      }
      return ok
    },
  })
  expect(parts).toHaveLength(1)
  expect(parts[0]?.image_url.url.startsWith(`data:${VISION_JPEG_MIME};base64,`)).toBe(true)
})
