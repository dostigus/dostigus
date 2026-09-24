/**
 * Artifact limits, sniff, and LLM notes. See ADR 0034.
 */

export const ARTIFACT_UI_MAX_BYTES = 10 * 1024 * 1024
export const ARTIFACT_PUT_BASE64_MAX_BYTES = 1 * 1024 * 1024
export const ARTIFACT_EXTRACT_MAX_BYTES = 32 * 1024
export const ARTIFACT_CLUSTER_QUOTA_BYTES = 512 * 1024 * 1024
export const ARTIFACT_PENDING_TTL_MS = 24 * 60 * 60 * 1000
export const ARTIFACT_PARTIAL_TTL_MS = 60 * 60 * 1000
export const ARTIFACTS_PER_MESSAGE_MAX = 3
export const ARTIFACT_LONG_PASTE_CHARS = 4_000
export const ARTIFACT_FILENAME_MAX = 255

export const ARTIFACT_STATUSES = ['partial', 'complete'] as const
export type ArtifactStatus = typeof ARTIFACT_STATUSES[number]

export type Artifact = {
  id: string
  filename: string
  mime: string
  byteSize: number
  createdAt: string
}

const IMAGE_SNIFF: Array<{ mime: string, test: (bytes: Uint8Array) => boolean }> = [
  {
    mime: 'image/jpeg',
    test: (bytes) => bytes.length >= 3
      && bytes[0] === 0xFF
      && bytes[1] === 0xD8
      && bytes[2] === 0xFF,
  },
  {
    mime: 'image/png',
    test: (bytes) => bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4E
      && bytes[3] === 0x47
      && bytes[4] === 0x0D
      && bytes[5] === 0x0A
      && bytes[6] === 0x1A
      && bytes[7] === 0x0A,
  },
  {
    mime: 'image/gif',
    test: (bytes) => bytes.length >= 6
      && bytes[0] === 0x47
      && bytes[1] === 0x49
      && bytes[2] === 0x46
      && bytes[3] === 0x38
      && (bytes[4] === 0x37 || bytes[4] === 0x39)
      && bytes[5] === 0x61,
  },
  {
    mime: 'image/webp',
    test: (bytes) => bytes.length >= 12
      && bytes[0] === 0x52
      && bytes[1] === 0x49
      && bytes[2] === 0x46
      && bytes[3] === 0x46
      && bytes[8] === 0x57
      && bytes[9] === 0x45
      && bytes[10] === 0x42
      && bytes[11] === 0x50,
  },
]

function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2D
}

function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 8_192))
  if (sample.length === 0) {
    return true
  }
  for (const byte of sample) {
    if (byte === 0) {
      return false
    }
  }
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(sample)
    return decoded.length > 0 || bytes.length === 0
  } catch {
    return false
  }
}

/** Magic-byte sniff. Client Content-Type is a hint only. */
export function sniffArtifactMime(bytes: Uint8Array): string | null {
  for (const row of IMAGE_SNIFF) {
    if (row.test(bytes)) {
      return row.mime
    }
  }
  if (isPdf(bytes)) {
    return 'application/pdf'
  }
  if (looksLikeText(bytes)) {
    return 'text/plain'
  }
  return null
}

export function isAllowlistedArtifactMime(mime: string): boolean {
  return mime.startsWith('image/')
    || mime === 'application/pdf'
    || mime === 'text/plain'
    || mime === 'text/markdown'
}

/**
 * Resolve the stored mime. Claimed type must match the sniff.
 * `text/markdown` may be claimed when the sniff is `text/plain`.
 */
export function resolveArtifactMime(bytes: Uint8Array, claimed?: string | null): string {
  const sniffed = sniffArtifactMime(bytes)
  if (!sniffed) {
    throw new Error('Artifact type is not allowed')
  }
  const hint = claimed?.trim().toLowerCase() ?? ''
  if (!hint) {
    return sniffed
  }
  if (sniffed.startsWith('image/')) {
    if (hint !== sniffed) {
      throw new Error('Artifact type does not match the file')
    }
    return sniffed
  }
  if (sniffed === 'application/pdf') {
    if (hint !== 'application/pdf') {
      throw new Error('Artifact type does not match the file')
    }
    return sniffed
  }
  if (hint === 'text/markdown' || hint === 'text/plain') {
    return hint
  }
  throw new Error('Artifact type does not match the file')
}

export function sanitizeArtifactFilename(value: string | undefined, fallback = 'file'): string {
  const stripped = [...(value ?? '')].filter((ch) => {
    const code = ch.charCodeAt(0)
    return ch !== '/' && ch !== '\\' && code >= 32
  }).join('')
  const base = stripped.trim()
  const name = base.length > 0 ? base : fallback
  return name.slice(0, ARTIFACT_FILENAME_MAX)
}

export function parseArtifactIds(value: unknown): string[] {
  if (value == null) {
    return []
  }
  const raw = Array.isArray(value) ? value : [value]
  const ids: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue
    }
    const id = item.trim()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
    if (ids.length >= ARTIFACTS_PER_MESSAGE_MAX) {
      break
    }
  }
  return ids
}

export function isImageArtifactMime(mime: string): boolean {
  return mime.startsWith('image/')
}

export function isTextArtifactMime(mime: string): boolean {
  return mime === 'text/plain' || mime === 'text/markdown' || mime.startsWith('text/')
}

/** UTF-8 body for text/*, capped. Null when the bytes are not text. */
export function extractArtifactText(bytes: Uint8Array, mime: string): string | null {
  if (!isTextArtifactMime(mime) && mime !== 'application/pdf') {
    return null
  }
  if (mime === 'application/pdf') {
    return extractPdfText(bytes)
  }
  const slice = bytes.subarray(0, ARTIFACT_EXTRACT_MAX_BYTES)
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(slice)
  } catch {
    return null
  }
}

function extractPdfText(bytes: Uint8Array): string | null {
  const raw = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 256 * 1024)))
  const chunks: string[] = []
  const literal = /\((?:\\.|[^\\)]){1,400}\)/g
  for (const match of raw.matchAll(literal)) {
    const inner = match[0].slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, '\t')
      .replace(/\\(.)/g, '$1')
    if (/\p{L}/u.test(inner)) {
      chunks.push(inner)
    }
    if (chunks.join('').length >= ARTIFACT_EXTRACT_MAX_BYTES) {
      break
    }
  }
  const text = chunks.join(' ').replace(/\s+/g, ' ').trim()
  if (text.length < 8) {
    return null
  }
  return text.slice(0, ARTIFACT_EXTRACT_MAX_BYTES)
}

export function artifactMetaNote(artifact: Pick<Artifact, 'id' | 'filename' | 'mime' | 'byteSize'>): string {
  return `${artifact.filename} (${artifact.mime}, ${artifact.byteSize} bytes, id ${artifact.id})`
}

export function artifactHistoryNote(
  artifacts: ReadonlyArray<Pick<Artifact, 'id' | 'filename' | 'mime' | 'byteSize'>>,
): string {
  if (artifacts.length === 0) {
    return ''
  }
  const lines = artifacts.map((artifact) => `- ${artifactMetaNote(artifact)}`)
  return `Attached Artifacts:\n${lines.join('\n')}`
}

export function withArtifactLlmContent(
  content: string,
  artifacts: ReadonlyArray<Pick<Artifact, 'id' | 'filename' | 'mime' | 'byteSize'>> | undefined,
  extract?: string | null,
): string {
  if (!artifacts?.length) {
    return content
  }
  const note = artifactHistoryNote(artifacts)
  if (extract && extract.trim()) {
    const body = extract.trim().slice(0, ARTIFACT_EXTRACT_MAX_BYTES)
    return [content, note, body].filter((part) => part.trim()).join('\n\n')
  }
  return [content, note].filter((part) => part.trim()).join('\n\n')
}

export function formatArtifactBytes(byteSize: number): string {
  if (byteSize < 1024) {
    return `${byteSize} B`
  }
  if (byteSize < 1024 * 1024) {
    return `${(byteSize / 1024).toFixed(byteSize < 10 * 1024 ? 1 : 0)} KB`
  }
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`
}
