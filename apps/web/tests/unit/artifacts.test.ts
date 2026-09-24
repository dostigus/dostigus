import { Buffer } from 'node:buffer'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBot, createMember, createOwner, insertArtifactRow, insertMessage, openStore } from '@dostigus/db'
import { ARTIFACT_CLUSTER_QUOTA_BYTES } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import {
  annotateHistoryWithArtifacts,
  ArtifactTurn,
  attachTurnArtifacts,
  attachUserArtifacts,
  clusterArtifactsDir,
  gcArtifacts,
  putArtifactBytes,
  putArtifactFromSourceUrl,
  putArtifactFromTool,
  viewerMayReadArtifact,
} from '../../server/utils/artifacts'
import { invokeChatMcpTool } from '../../server/utils/mcp-platform-tools'

const opened: Array<ReturnType<typeof openStore>> = []
const dirs: string[] = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'dostigus-artifacts-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
  while (dirs.length > 0) {
    rmSync(dirs.pop()!, { recursive: true, force: true })
  }
})

const png = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01])
const jpeg = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46])
const text = new TextEncoder().encode('hello from a note')

function seedOwner() {
  const store = memoryStore()
  const owner = createOwner(store, { email: 'owner@example.test', passwordHash: 'hash:owner' })
  const { bot } = createBot(store, { createdBy: owner.id })
  return { store, owner, bot, dir: tempDir() }
}

it('rejects a claimed mime that does not match sniffed bytes', () => {
  const { store, owner, dir } = seedOwner()
  expect(() => putArtifactBytes(store, {
    bytes: jpeg,
    filename: 'photo.png',
    mime: 'image/png',
    actorPersonId: owner.id,
    dir,
  })).toThrow(/does not match/)
})

it('returns HTTP 507 when Cluster Artifact quota is full', () => {
  const { store, owner, dir } = seedOwner()
  insertArtifactRow(store, {
    filename: 'big.bin',
    mime: 'text/plain',
    byteSize: ARTIFACT_CLUSTER_QUOTA_BYTES,
    contentHash: 'full',
    actorPersonId: owner.id,
  })
  expect(() => putArtifactBytes(store, {
    bytes: text,
    filename: 'note.txt',
    mime: 'text/plain',
    actorPersonId: owner.id,
    dir,
  })).toThrow(/storage is full/)
  try {
    putArtifactBytes(store, {
      bytes: text,
      filename: 'note.txt',
      mime: 'text/plain',
      actorPersonId: owner.id,
      dir,
    })
  } catch (error) {
    expect(error).toMatchObject({ statusCode: 507 })
  }
})

it('denies GET without a join or on the wrong Thread', () => {
  const { store, owner, bot, dir } = seedOwner()
  const pending = putArtifactBytes(store, {
    bytes: text,
    filename: 'note.txt',
    mime: 'text/plain',
    actorPersonId: owner.id,
    dir,
  })
  const ownerView = { id: owner.id, role: 'owner' as const }
  expect(viewerMayReadArtifact(store, pending.id, ownerView)).toBe(false)

  const user = insertMessage(store, {
    botId: bot.id,
    role: 'user',
    content: 'with file',
    personId: owner.id,
    viewer: ownerView,
  })
  attachUserArtifacts(store, user.id, [pending.id], owner.id)
  expect(viewerMayReadArtifact(store, pending.id, ownerView)).toBe(true)

  const member = createMember(store, {
    displayName: 'Ada',
    username: 'ada',
    passwordHash: 'hash:ada',
  })
  const memberView = { id: member.id, role: 'member' as const }
  expect(viewerMayReadArtifact(store, pending.id, memberView)).toBe(false)

  const src = readFileSync(join(import.meta.dirname, '../../server/api/artifacts/[id].get.ts'), 'utf8')
  expect(src).toContain('requireHostSession')
  expect(src).toContain('openArtifactStream')
  const post = readFileSync(join(import.meta.dirname, '../../server/api/artifacts/index.post.ts'), 'utf8')
  expect(post).toContain('requireHostSession')
})

it('pending GC does not delete a joined Artifact', () => {
  const { store, owner, bot, dir } = seedOwner()
  const old = Date.now() - (26 * 60 * 60 * 1000)
  const pending = insertArtifactRow(store, {
    filename: 'old.txt',
    mime: 'text/plain',
    byteSize: 4,
    contentHash: 'old',
    actorPersonId: owner.id,
    createdAt: old,
  })
  const kept = putArtifactBytes(store, {
    bytes: text,
    filename: 'kept.txt',
    mime: 'text/plain',
    actorPersonId: owner.id,
    dir,
  })
  const user = insertMessage(store, {
    botId: bot.id,
    role: 'user',
    content: 'keep',
    personId: owner.id,
    viewer: { id: owner.id, role: 'owner' },
  })
  attachUserArtifacts(store, user.id, [kept.id], owner.id)
  const { deleted } = gcArtifacts(store, { now: Date.now(), dir })
  expect(deleted).toContain(pending.id)
  expect(deleted).not.toContain(kept.id)
})

it('blocks sourceUrl SSRF the same way as Host HTTP get', async () => {
  const { store, owner, dir } = seedOwner()
  await expect(putArtifactFromSourceUrl(store, {
    sourceUrl: 'http://127.0.0.1/secret',
    filename: 'x.txt',
    mime: 'text/plain',
    actorPersonId: owner.id,
    dir,
  })).rejects.toThrow(/blocked destination/)
})

it('auto-attaches a Bot put to the assistant message', async () => {
  const { store, owner, bot, dir } = seedOwner()
  const turn = new ArtifactTurn()
  const result = await invokeChatMcpTool({
    name: 'dostigus_artifacts_put',
    args: {
      filename: 'note.txt',
      mime: 'text/plain',
      bytesBase64: Buffer.from(text).toString('base64'),
    },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    artifacts: turn,
  })
  expect(result.ok).toBe(true)
  expect(turn.ids).toHaveLength(1)
  const assistant = insertMessage(store, {
    botId: bot.id,
    role: 'assistant',
    content: 'here',
    viewer: { id: owner.id, role: 'owner' },
  })
  const joined = attachTurnArtifacts(store, assistant.id, turn.ids)
  expect(joined.map((item) => item.filename)).toEqual(['note.txt'])
  expect(dir).toBeTruthy()
})

it('sends artifactIds with a Chat line', () => {
  const { store, owner, bot, dir } = seedOwner()
  const artifact = putArtifactBytes(store, {
    bytes: png,
    filename: 'shot.png',
    mime: 'image/png',
    actorPersonId: owner.id,
    dir,
  })
  const user = insertMessage(store, {
    botId: bot.id,
    role: 'user',
    content: '',
    personId: owner.id,
    viewer: { id: owner.id, role: 'owner' },
    allowEmpty: true,
  })
  const joined = attachUserArtifacts(store, user.id, [artifact.id], owner.id)
  expect(joined).toHaveLength(1)
  expect(joined[0]?.mime).toBe('image/png')
  const src = readFileSync(join(import.meta.dirname, '../../server/api/bots/[id]/messages.post.ts'), 'utf8')
  expect(src).toContain('artifactIds')
  expect(src).toContain('attachUserArtifacts')
  expect(src).toContain('parseArtifactIds')
  const composer = readFileSync(join(import.meta.dirname, '../../app/composables/useComposerAttachments.ts'), 'utf8')
  expect(composer).toContain('if (!list || list.length === 0)')
  expect(composer).toContain('dragDepth')
  expect(composer).toContain('ARTIFACT_LONG_PASTE_CHARS')
  expect(composer).toContain('createObjectURL')
})

it('injects text extract on the triggering line only', () => {
  const { store, owner, dir } = seedOwner()
  const artifact = putArtifactBytes(store, {
    bytes: text,
    filename: 'note.txt',
    mime: 'text/plain',
    actorPersonId: owner.id,
    dir,
  })
  const older = {
    id: 'old',
    role: 'user' as const,
    content: 'earlier',
    artifacts: [artifact],
  }
  const trigger = {
    id: 'now',
    role: 'user' as const,
    content: 'read this',
    artifacts: [artifact],
  }
  const annotated = annotateHistoryWithArtifacts([older, trigger], { dir })
  expect(annotated[0]?.content).toContain('note.txt')
  expect(annotated[0]?.content).not.toContain('hello from a note')
  expect(annotated[1]?.content).toContain('hello from a note')

  const onVolume = putArtifactBytes(store, {
    bytes: text,
    filename: 'volume.txt',
    mime: 'text/plain',
    actorPersonId: owner.id,
  })
  expect(clusterArtifactsDir('')).toMatch(/artifacts/)
  expect(clusterArtifactsDir('   ')).toMatch(/artifacts/)
  const fromDefault = annotateHistoryWithArtifacts([{
    id: 'trigger',
    role: 'user' as const,
    content: 'read this',
    artifacts: [onVolume],
  }])
  expect(fromDefault[0]?.content).toContain('hello from a note')
})

it('writes bytesBase64 through putArtifactFromTool', async () => {
  const { store, owner, dir } = seedOwner()
  const artifact = await putArtifactFromTool(store, {
    filename: 'note.txt',
    mime: 'text/plain',
    bytesBase64: Buffer.from(text).toString('base64'),
    actorPersonId: owner.id,
    dir,
  })
  expect(artifact.filename).toBe('note.txt')
  expect(artifact.byteSize).toBe(text.byteLength)
})
