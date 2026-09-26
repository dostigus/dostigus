/**
 * STORE zip of a Pack tree. Share is a zip of pack.json + skills/ +
 * optional schedules/ + optional ui/ + optional README. See ADR 0039.
 */

const LOCAL_SIG = 0x04034B50
const CENTRAL_SIG = 0x02014B50
const EOCD_SIG = 0x06054B50
const GP_UTF8 = 0x0800

const CRC_TABLE = new Uint32Array(256)
for (let index = 0; index < 256; index += 1) {
  let crc = index
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? (0xEDB88320 ^ (crc >>> 1)) : crc >>> 1
  }
  CRC_TABLE[index] = crc >>> 0
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xFF]! ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function u16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true)
}

function u32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true)
}

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, true)
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}

export function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4B
    && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
}

export function zipPackFiles(files: Record<string, string>): Uint8Array {
  const entries = Object.entries(files)
    .map(([path, text]) => {
      const name = path.replaceAll('\\', '/').replace(/^\.\//, '')
      return { name, data: new TextEncoder().encode(text) }
    })
    .filter((entry) => entry.name.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name))

  const localChunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name)
    const crc = crc32(entry.data)
    const local = new Uint8Array(30 + nameBytes.length + entry.data.length)
    const localView = new DataView(local.buffer)
    u32(localView, 0, LOCAL_SIG)
    u16(localView, 4, 20)
    u16(localView, 6, GP_UTF8)
    u16(localView, 8, 0)
    u16(localView, 10, 0)
    u16(localView, 12, 0)
    u32(localView, 14, crc)
    u32(localView, 18, entry.data.length)
    u32(localView, 22, entry.data.length)
    u16(localView, 26, nameBytes.length)
    u16(localView, 28, 0)
    local.set(nameBytes, 30)
    local.set(entry.data, 30 + nameBytes.length)
    localChunks.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    u32(centralView, 0, CENTRAL_SIG)
    u16(centralView, 4, 20)
    u16(centralView, 6, 20)
    u16(centralView, 8, GP_UTF8)
    u16(centralView, 10, 0)
    u16(centralView, 12, 0)
    u16(centralView, 14, 0)
    u32(centralView, 16, crc)
    u32(centralView, 20, entry.data.length)
    u32(centralView, 24, entry.data.length)
    u16(centralView, 28, nameBytes.length)
    u16(centralView, 30, 0)
    u16(centralView, 32, 0)
    u16(centralView, 34, 0)
    u16(centralView, 36, 0)
    u32(centralView, 38, 0)
    u32(centralView, 42, offset)
    central.set(nameBytes, 46)
    centralChunks.push(central)
    offset += local.length
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  u32(eocdView, 0, EOCD_SIG)
  u16(eocdView, 4, 0)
  u16(eocdView, 6, 0)
  u16(eocdView, 8, entries.length)
  u16(eocdView, 10, entries.length)
  u32(eocdView, 12, centralSize)
  u32(eocdView, 16, offset)
  u16(eocdView, 20, 0)

  const out = new Uint8Array(offset + centralSize + eocd.length)
  let cursor = 0
  for (const chunk of localChunks) {
    out.set(chunk, cursor)
    cursor += chunk.length
  }
  for (const chunk of centralChunks) {
    out.set(chunk, cursor)
    cursor += chunk.length
  }
  out.set(eocd, cursor)
  return out
}

function findEocd(bytes: Uint8Array): number {
  const maxComment = Math.min(bytes.length - 22, 0xFFFF)
  for (let comment = 0; comment <= maxComment; comment += 1) {
    const offset = bytes.length - 22 - comment
    if (offset < 0) {
      break
    }
    if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4B
      && bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06) {
      return offset
    }
  }
  throw new Error('Not a Pack zip')
}

const SKIP_NAME = /(?:^|\/)(?:\.DS_Store|__MACOSX(?:\/|$))/

export function unzipPackFiles(bytes: Uint8Array): Record<string, string> {
  if (!isZipBytes(bytes)) {
    throw new Error('Not a Pack zip')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEocd(bytes)
  const count = readU16(view, eocd + 8)
  const centralSize = readU32(view, eocd + 12)
  const centralOffset = readU32(view, eocd + 16)
  if (centralOffset + centralSize > bytes.length) {
    throw new Error('Not a Pack zip')
  }

  const files: Record<string, string> = {}
  let cursor = centralOffset
  for (let index = 0; index < count; index += 1) {
    if (readU32(view, cursor) !== CENTRAL_SIG) {
      throw new Error('Not a Pack zip')
    }
    const method = readU16(view, cursor + 10)
    const compressed = readU32(view, cursor + 20)
    const nameLen = readU16(view, cursor + 28)
    const extraLen = readU16(view, cursor + 30)
    const commentLen = readU16(view, cursor + 32)
    const localOffset = readU32(view, cursor + 42)
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen))
    cursor += 46 + nameLen + extraLen + commentLen
    if (!name || name.endsWith('/') || SKIP_NAME.test(name)) {
      continue
    }
    if (name.includes('..') || name.startsWith('/') || name.includes('\\')) {
      throw new Error('Pack zip path is not allowed')
    }
    if (method !== 0) {
      throw new Error('Pack zip must use stored files')
    }
    if (readU32(view, localOffset) !== LOCAL_SIG) {
      throw new Error('Not a Pack zip')
    }
    const localNameLen = readU16(view, localOffset + 26)
    const localExtra = readU16(view, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLen + localExtra
    const data = bytes.subarray(dataStart, dataStart + compressed)
    files[name] = new TextDecoder().decode(data)
  }
  return files
}
