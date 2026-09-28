/**
 * Fetch a Pack from a public zip URL or clone an https git remote.
 * Destination SSRF matches Host HTTP get. See ADR 0031 and ADR 0039.
 */

import type { PackRemoteSource, PackTree } from '@dostigus/shared'
import type { HostHttpLookup } from './http-get'
import { execFile } from 'node:child_process'
import { lookup as dnsLookup } from 'node:dns/promises'
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { StoreError } from '@dostigus/db'
import {
  detectPackRemoteSource,
  isZipBytes,
  PACK_REMOTE_CLONE_FAILED,
  PACK_REMOTE_MAX_BYTES,
  PACK_REMOTE_TIMEOUT,
  PACK_REMOTE_TIMEOUT_MS,
  PACK_REMOTE_TOO_LARGE,
  PACK_REMOTE_ZIP_FETCH,
  PACK_REMOTE_ZIP_ONLY,
  PackInputError,
  parsePackTreeFromFiles,
  parsePackZip,
} from '@dostigus/shared'
import { assertHostHttpGetDestination, hostHttpGetBytes } from './http-get'
import { resolveBotHttpOutboundProxy } from './outbound-fetch'

const execFileAsync = promisify(execFile)

export type PackRemoteClone = (input: {
  url: string
  dest: string
  ref?: string
  timeoutMs: number
  env: NodeJS.ProcessEnv
}) => Promise<void>

export type PackRemoteOptions = {
  url: string
  path?: string
  ref?: string
  fetchImpl?: typeof fetch
  lookup?: HostHttpLookup
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  maxBytes?: number
  cloneGit?: PackRemoteClone
  now?: () => number
}

function asRemote<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    if (error instanceof PackInputError) {
      throw new StoreError(error.message, error.statusCode)
    }
    throw error
  }
}

async function asRemoteAsync<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof PackInputError) {
      throw new StoreError(error.message, error.statusCode)
    }
    throw error
  }
}

function gitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = {
    ...env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_LFS_SKIP_SMUDGE: '1',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
  }
  const proxy = resolveBotHttpOutboundProxy(env)
  if (proxy.kind === 'invalid') {
    throw new StoreError('Bot HTTP proxy URL is invalid', 400)
  }
  if (proxy.kind === 'proxy') {
    next.https_proxy = proxy.href
    next.http_proxy = proxy.href
    next.HTTPS_PROXY = proxy.href
    next.HTTP_PROXY = proxy.href
  }
  return next
}

export async function clonePackGitRemote(input: {
  url: string
  dest: string
  ref?: string
  timeoutMs: number
  env: NodeJS.ProcessEnv
}): Promise<void> {
  const args = [
    'clone',
    '--depth',
    '1',
    '--single-branch',
    '--no-recurse-submodules',
  ]
  if (input.ref) {
    args.push('--branch', input.ref)
  }
  args.push('--', input.url, input.dest)
  try {
    await execFileAsync('git', args, {
      timeout: input.timeoutMs,
      env: gitEnv(input.env),
      maxBuffer: 1_048_576,
    })
  } catch (error) {
    const err = error as { killed?: boolean, signal?: string, message?: string }
    if (err.killed || err.signal === 'SIGTERM') {
      throw new StoreError(PACK_REMOTE_TIMEOUT, 504)
    }
    throw new StoreError(PACK_REMOTE_CLONE_FAILED, 400)
  }
}

function assertInside(root: string, candidate: string): string {
  const base = resolve(root)
  const next = resolve(candidate)
  if (next !== base && !next.startsWith(`${base}${sep}`)) {
    throw new StoreError(PACK_REMOTE_CLONE_FAILED, 400)
  }
  return next
}

export async function readPackWorkingTree(
  root: string,
  maxBytes: number,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  let total = 0

  async function walk(dir: string, rel: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === '.gitmodules' || entry.name === '.DS_Store') {
        continue
      }
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name
      const full = assertInside(root, join(dir, entry.name))
      if (entry.isSymbolicLink()) {
        continue
      }
      if (entry.isDirectory()) {
        await walk(full, nextRel)
        continue
      }
      if (!entry.isFile()) {
        continue
      }
      const info = await stat(full)
      total += info.size
      if (total > maxBytes) {
        throw new StoreError(PACK_REMOTE_TOO_LARGE, 400)
      }
      files[nextRel] = await readFile(full, 'utf8')
    }
  }

  await walk(root, '')
  return files
}

async function fetchPackZip(source: PackRemoteSource & { kind: 'url' }, options: PackRemoteOptions): Promise<PackTree> {
  const env = options.env ?? process.env
  const lookupFn = options.lookup ?? dnsLookup
  const timeoutMs = options.timeoutMs ?? PACK_REMOTE_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? PACK_REMOTE_MAX_BYTES
  const url = new URL(source.url)
  await assertHostHttpGetDestination(url, [], lookupFn)
  let fetched
  try {
    fetched = await hostHttpGetBytes(source.url, {
      allowlist: [],
      fetchImpl: options.fetchImpl,
      lookup: lookupFn,
      env,
      timeoutMs,
      maxBytes,
      now: options.now,
    })
  } catch (error) {
    if (error instanceof StoreError && error.message === 'Host HTTP get timed out') {
      throw new StoreError(PACK_REMOTE_TIMEOUT, 504)
    }
    throw error
  }
  if (fetched.status < 200 || fetched.status >= 300) {
    throw new StoreError(PACK_REMOTE_ZIP_FETCH, 400)
  }
  if (fetched.truncated) {
    throw new StoreError(PACK_REMOTE_TOO_LARGE, 400)
  }
  if (!isZipBytes(fetched.bytes)) {
    throw new StoreError(PACK_REMOTE_ZIP_ONLY, 400)
  }
  return asRemote(() => parsePackZip(fetched.bytes, maxBytes))
}

async function fetchPackGit(source: PackRemoteSource & { kind: 'git' }, options: PackRemoteOptions): Promise<PackTree> {
  const env = options.env ?? process.env
  const lookupFn = options.lookup ?? dnsLookup
  const timeoutMs = options.timeoutMs ?? PACK_REMOTE_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? PACK_REMOTE_MAX_BYTES
  const clone = options.cloneGit ?? clonePackGitRemote
  const url = new URL(source.url)
  await assertHostHttpGetDestination(url, [], lookupFn)
  const parent = await mkdtemp(join(tmpdir(), 'dostigus-pack-'))
  try {
    const dest = join(parent, 'repo')
    await clone({
      url: source.url,
      dest,
      ref: source.ref,
      timeoutMs,
      env,
    })
    const root = source.path ? assertInside(dest, join(dest, ...source.path.split('/'))) : dest
    const files = await readPackWorkingTree(root, maxBytes)
    return asRemote(() => parsePackTreeFromFiles(files))
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
}

export async function fetchPackFromRemote(options: PackRemoteOptions): Promise<{
  pack: PackTree
  source: PackRemoteSource
}> {
  const source = asRemote(() => detectPackRemoteSource({
    url: options.url,
    path: options.path,
    ref: options.ref,
  }))
  const pack = await asRemoteAsync(async () => {
    if (source.kind === 'url') {
      return fetchPackZip(source, options)
    }
    return fetchPackGit(source, options)
  })
  return {
    pack: { ...pack, source },
    source,
  }
}
