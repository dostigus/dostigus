/**
 * Pack Apply source: file, public zip URL, or https git remote.
 * See ADR 0039.
 */

export class PackInputError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message)
    this.name = 'PackInputError'
  }
}

export const PACK_REMOTE_MAX_BYTES = 25_000_000
export const PACK_REMOTE_TIMEOUT_MS = 60_000

export const PACK_REMOTE_HINT
  = 'Paste a .zip URL or an https git remote'

export const PACK_REMOTE_ZIP_ONLY
  = 'Pack URL Apply accepts a .zip file only, not pack.json or a web page'

export const PACK_REMOTE_GIT_HTTPS
  = 'Git Apply uses https remotes only'

export const PACK_REMOTE_GIT_AUTH
  = 'Git Apply does not use SSH or private auth'

export const PACK_REMOTE_TOO_LARGE
  = 'Pack archive is too large'

export const PACK_REMOTE_TIMEOUT
  = 'Pack remote Apply timed out'

export const PACK_REMOTE_CLONE_FAILED
  = 'Could not clone the git remote'

export const PACK_REMOTE_PATH
  = 'Git path is not allowed'

export const PACK_REMOTE_ZIP_FETCH
  = 'Could not fetch the Pack zip'

export const PACK_REMOTE_REF
  = 'Git ref is not allowed'

export type PackFileSource = {
  kind: 'file'
}

export type PackUrlSource = {
  kind: 'url'
  url: string
}

export type PackGitSource = {
  kind: 'git'
  url: string
  ref?: string
  path?: string
}

export type PackSource = PackFileSource | PackUrlSource | PackGitSource

export type PackRemoteSource = PackUrlSource | PackGitSource

const KNOWN_GIT_HOSTS = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'codeberg.org',
  'git.sr.ht',
])

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PackInputError(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

export function isZipContentType(value: string | undefined | null): boolean {
  if (!value) {
    return false
  }
  const type = value.split(';')[0]!.trim().toLowerCase()
  return type === 'application/zip'
    || type === 'application/x-zip-compressed'
    || type === 'application/x-zip'
    || type === 'multipart/x-zip'
}

export function pathnameLooksLikeZip(pathname: string): boolean {
  return pathname.toLowerCase().split('/').pop()?.endsWith('.zip') === true
}

function hostnameOf(host: string): string {
  return host.replace(/^www\./i, '').toLowerCase()
}

function rejectCredentials(url: URL): void {
  if (url.username || url.password) {
    throw new PackInputError(PACK_REMOTE_GIT_AUTH)
  }
}

function looksLikeSshPaste(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.startsWith('git@')
    || trimmed.startsWith('ssh://')
    || /^[\w.-]+@[\w.-]+:/i.test(trimmed)
}

export function sanitizePackGitPath(value: string | undefined | null): string | undefined {
  if (value == null) {
    return undefined
  }
  const path = value.trim().replaceAll('\\', '/').replace(/^\/+/, '')
  if (!path) {
    return undefined
  }
  const parts = path.split('/').filter((part) => part && part !== '.')
  if (parts.length === 0) {
    return undefined
  }
  if (parts.some((part) => part === '..' || part === '.git')) {
    throw new PackInputError(PACK_REMOTE_PATH)
  }
  return parts.join('/')
}

export function sanitizePackGitRef(value: string | undefined | null): string | undefined {
  if (value == null) {
    return undefined
  }
  const ref = value.trim()
  if (!ref) {
    return undefined
  }
  if (
    ref.startsWith('-')
    || ref.includes('..')
    || ref.includes('\\')
    || ref.includes(' ')
    || ref.includes('\n')
    || ref.length > 255
  ) {
    throw new PackInputError(PACK_REMOTE_REF)
  }
  return ref
}

function withOverrides(
  source: PackRemoteSource,
  path?: string,
  ref?: string,
): PackRemoteSource {
  if (source.kind === 'url') {
    return source
  }
  const nextPath = path ?? source.path
  const nextRef = ref ?? source.ref
  return {
    kind: 'git',
    url: source.url,
    ...(nextRef ? { ref: nextRef } : {}),
    ...(nextPath ? { path: nextPath } : {}),
  }
}

function parseGitHubWeb(url: URL): PackRemoteSource | null {
  if (hostnameOf(url.hostname) !== 'github.com') {
    return null
  }
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  if (parts.length < 2) {
    throw new PackInputError(PACK_REMOTE_HINT)
  }
  const owner = parts[0]!
  const repoRaw = parts[1]!
  const repo = repoRaw.endsWith('.git') ? repoRaw.slice(0, -4) : repoRaw
  if (!owner || !repo || owner === '.' || repo === '.') {
    throw new PackInputError(PACK_REMOTE_HINT)
  }
  const clone = `https://github.com/${owner}/${repo}.git`
  const extra = parts.slice(2)
  if (extra.length === 0) {
    return { kind: 'git', url: clone }
  }
  const head = extra[0]!.toLowerCase()
  if (head === 'tree') {
    if (extra.length < 2) {
      throw new PackInputError(PACK_REMOTE_HINT)
    }
    const ref = sanitizePackGitRef(extra[1])
    const path = sanitizePackGitPath(extra.slice(2).join('/'))
    return {
      kind: 'git',
      url: clone,
      ...(ref ? { ref } : {}),
      ...(path ? { path } : {}),
    }
  }
  if (head === 'blob') {
    throw new PackInputError(PACK_REMOTE_ZIP_ONLY)
  }
  if (head === 'archive' || head === 'releases' || head === 'raw') {
    return null
  }
  throw new PackInputError(PACK_REMOTE_HINT)
}

function parseKnownGitHost(url: URL): PackRemoteSource | null {
  const host = hostnameOf(url.hostname)
  if (!KNOWN_GIT_HOSTS.has(host)) {
    return null
  }
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  if (parts.length !== 2) {
    return null
  }
  const owner = parts[0]!
  const repoRaw = parts[1]!
  const repo = repoRaw.endsWith('.git') ? repoRaw.slice(0, -4) : repoRaw
  if (!owner || !repo) {
    return null
  }
  return { kind: 'git', url: `https://${host}/${owner}/${repo}.git` }
}

export function detectPackRemoteSource(input: {
  url: string
  path?: string
  ref?: string
  contentType?: string | null
}): PackRemoteSource {
  const raw = input.url.trim()
  if (!raw) {
    throw new PackInputError(PACK_REMOTE_HINT)
  }
  if (looksLikeSshPaste(raw)) {
    throw new PackInputError(PACK_REMOTE_GIT_AUTH)
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new PackInputError(PACK_REMOTE_HINT)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new PackInputError(PACK_REMOTE_HINT)
  }
  rejectCredentials(parsed)
  const pathOverride = sanitizePackGitPath(input.path)
  const refOverride = sanitizePackGitRef(input.ref)
  if (pathnameLooksLikeZip(parsed.pathname) || isZipContentType(input.contentType)) {
    return { kind: 'url', url: parsed.href }
  }
  if (parsed.protocol !== 'https:') {
    throw new PackInputError(PACK_REMOTE_GIT_HTTPS)
  }
  const github = parseGitHubWeb(parsed)
  if (github) {
    return withOverrides(github, pathOverride, refOverride)
  }
  if (parsed.pathname.toLowerCase().endsWith('.git')) {
    return withOverrides({ kind: 'git', url: parsed.href }, pathOverride, refOverride)
  }
  const known = parseKnownGitHost(parsed)
  if (known) {
    return withOverrides(known, pathOverride, refOverride)
  }
  throw new PackInputError(PACK_REMOTE_HINT)
}

export function parsePackSource(value: unknown): PackSource | undefined {
  if (value == null) {
    return undefined
  }
  const row = asRecord(value, 'source')
  if (row.kind === 'file') {
    return { kind: 'file' }
  }
  if (row.kind === 'url') {
    if (typeof row.url !== 'string' || !row.url.trim()) {
      throw new PackInputError('Pack source url is required')
    }
    return { kind: 'url', url: row.url.trim() }
  }
  if (row.kind === 'git') {
    if (typeof row.url !== 'string' || !row.url.trim()) {
      throw new PackInputError('Pack source url is required')
    }
    const ref = typeof row.ref === 'string' ? sanitizePackGitRef(row.ref) : undefined
    const path = typeof row.path === 'string' ? sanitizePackGitPath(row.path) : undefined
    return {
      kind: 'git',
      url: row.url.trim(),
      ...(ref ? { ref } : {}),
      ...(path ? { path } : {}),
    }
  }
  throw new PackInputError('Pack source kind must be file, url, or git')
}
