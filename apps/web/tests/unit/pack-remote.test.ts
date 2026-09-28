import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HOST_ENGINE_VERSION, PACK_FORMAT, packTreeToZip, parsePackManifest } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import { packTreeFromUpload } from '../../server/utils/cluster-packs'
import { fetchPackFromRemote, readPackWorkingTree } from '../../server/utils/pack-remote'

function lookup(map: Record<string, string[]>) {
  return async (hostname: string) => map[hostname]?.map((address) => ({
    address,
    family: address.includes(':') ? 6 : 4,
  })) ?? Promise.reject(new Error('ENOTFOUND'))
}

function sampleZip(): Uint8Array {
  return packTreeToZip({
    manifest: parsePackManifest({
      packFormat: PACK_FORMAT,
      engines: { dostigus: `>=${HOST_ENGINE_VERSION}` },
      id: 'ada.notes',
      version: '1.0.0',
      soul: 'Keep short notes.',
    }),
    skills: [{
      id: 'notes',
      description: 'Keep short notes',
      instructions: 'Write everything down.',
    }],
    schedules: [],
    uiFiles: [],
    readme: '',
  })
}

const temps: string[] = []

afterEach(async () => {
  while (temps.length > 0) {
    const dir = temps.pop()
    if (dir) {
      await rm(dir, { recursive: true, force: true })
    }
  }
})

it('rejects a private or loopback zip URL before fetch', async () => {
  await expect(fetchPackFromRemote({
    url: 'http://127.0.0.1/secret.zip',
  })).rejects.toThrow(/blocked destination/)

  await expect(fetchPackFromRemote({
    url: 'https://evil.example/pack.zip',
    lookup: lookup({ 'evil.example': ['10.0.0.8'] }),
    fetchImpl: (async () => new Response('leaked', { status: 200 })) as typeof fetch,
  })).rejects.toThrow(/blocked destination/)

  await expect(fetchPackFromRemote({
    url: 'https://metadata.example/pack.zip',
    lookup: lookup({ 'metadata.example': ['169.254.169.254'] }),
  })).rejects.toThrow(/blocked destination/)
})

it('rejects a git remote that resolves to a private address', async () => {
  await expect(fetchPackFromRemote({
    url: 'https://git.internal/ada/notes.git',
    lookup: lookup({ 'git.internal': ['192.168.1.9'] }),
    cloneGit: async () => {
      throw new Error('must not clone')
    },
  })).rejects.toThrow(/blocked destination/)
})

it('parses a public zip fetch and stamps url source', async () => {
  const zip = sampleZip()
  const fetched = await fetchPackFromRemote({
    url: 'https://cdn.example/ada.notes-1.0.0.zip',
    lookup: lookup({ 'cdn.example': ['1.2.3.4'] }),
    fetchImpl: (async () => new Response(zip, {
      status: 200,
      headers: { 'content-type': 'application/zip' },
    })) as typeof fetch,
  })
  expect(fetched.pack.manifest.id).toBe('ada.notes')
  expect(fetched.pack.skills[0]?.id).toBe('notes')
  expect(fetched.source).toEqual({
    kind: 'url',
    url: 'https://cdn.example/ada.notes-1.0.0.zip',
  })
  expect(fetched.pack.source).toEqual(fetched.source)
})

it('rejects HTML served as a zip URL', async () => {
  await expect(fetchPackFromRemote({
    url: 'https://github.com/ada/notes/archive/refs/heads/main.zip',
    lookup: lookup({ 'github.com': ['1.2.3.4'] }),
    fetchImpl: (async () => new Response('<html>tree</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })) as typeof fetch,
  })).rejects.toThrow(/zip file only/)
})

it('unwraps a single wrapper folder from a git checkout path', async () => {
  const fetched = await fetchPackFromRemote({
    url: 'https://github.com/ada/notes/tree/main/share',
    lookup: lookup({ 'github.com': ['1.2.3.4'] }),
    cloneGit: async ({ dest }) => {
      await mkdir(join(dest, 'share'), { recursive: true })
      await writeFile(join(dest, 'share', 'pack.json'), JSON.stringify({
        packFormat: PACK_FORMAT,
        engines: { dostigus: `>=${HOST_ENGINE_VERSION}` },
        id: 'ada.notes',
        version: '1.2.0',
        soul: 'From git.',
      }))
    },
  })
  expect(fetched.pack.manifest.version).toBe('1.2.0')
  expect(fetched.source).toEqual({
    kind: 'git',
    url: 'https://github.com/ada/notes.git',
    ref: 'main',
    path: 'share',
  })
})

it('unwraps a wrapped pack.json at the git checkout root', async () => {
  const fetched = await fetchPackFromRemote({
    url: 'https://github.com/ada/notes.git',
    lookup: lookup({ 'github.com': ['1.2.3.4'] }),
    cloneGit: async ({ dest }) => {
      await mkdir(join(dest, 'notes-1.0.0'), { recursive: true })
      await writeFile(join(dest, 'notes-1.0.0', 'pack.json'), JSON.stringify({
        packFormat: PACK_FORMAT,
        engines: { dostigus: `>=${HOST_ENGINE_VERSION}` },
        id: 'ada.notes',
        version: '1.0.3',
      }))
    },
  })
  expect(fetched.pack.manifest.version).toBe('1.0.3')
  expect(fetched.source.kind).toBe('git')
})

it('keeps the Apply-from-zip-bytes path (file source)', () => {
  const zip = sampleZip()
  const tree = packTreeFromUpload({ bytes: zip, filename: 'ada.notes-1.0.0.zip' })
  expect(tree.manifest.id).toBe('ada.notes')
  expect(tree.source).toEqual({ kind: 'file' })
})

it('caps a working tree payload', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dostigus-pack-tree-'))
  temps.push(dir)
  await writeFile(join(dir, 'pack.json'), `${'x'.repeat(80)}\n`)
  await expect(readPackWorkingTree(dir, 20)).rejects.toThrow(/too large/)
})
