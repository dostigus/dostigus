import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import {
  artifactsDirFromStoreUrl,
  attachArtifactsToMessages,
  createBot,
  createOwner,
  deleteArtifactRows,
  getArtifact,
  insertArtifactRow,
  insertMessage,
  joinMessageArtifacts,
  listOrphanArtifactIds,
  listPendingArtifactIds,
  listThreadMessages,
  openStore,
} from '../../src/index'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('places Artifact bytes next to the Store file', () => {
  expect(artifactsDirFromStoreUrl('file:/var/lib/dostigus/cluster.sqlite')).toBe(
    '/var/lib/dostigus/artifacts',
  )
  expect(artifactsDirFromStoreUrl('file:.data/cluster.sqlite')).toBe('.data/artifacts')
})

it('joins Artifacts on a message and lists them with the line', () => {
  const store = memoryStore()
  const owner = createOwner(store, { email: 'owner@example.test', passwordHash: 'hash:owner' })
  const { bot } = createBot(store, { createdBy: owner.id })
  const artifact = insertArtifactRow(store, {
    filename: 'notes.md',
    mime: 'text/markdown',
    byteSize: 12,
    contentHash: 'abc',
    actorPersonId: owner.id,
  })
  const user = insertMessage(store, {
    botId: bot.id,
    role: 'user',
    content: 'see this',
    personId: owner.id,
    viewer: { id: owner.id, role: 'owner' },
  })
  joinMessageArtifacts(store, user.id, [artifact.id])
  const threadId = (
    store.sqlite.prepare('SELECT thread_id FROM messages WHERE id = ?').get(user.id) as { thread_id: string }
  ).thread_id
  const withJoin = listThreadMessages(store, threadId).find((line) => line.id === user.id)
  expect(withJoin?.artifacts?.map((item) => item.filename)).toEqual(['notes.md'])
  expect(attachArtifactsToMessages(store, [user])[0]?.artifacts?.[0]?.id).toBe(artifact.id)
})

it('pending GC skips an Artifact that a message already joins', () => {
  const store = memoryStore()
  const owner = createOwner(store, { email: 'owner@example.test', passwordHash: 'hash:owner' })
  const { bot } = createBot(store, { createdBy: owner.id })
  const old = Date.now() - (25 * 60 * 60 * 1000)
  const pending = insertArtifactRow(store, {
    filename: 'old.txt',
    mime: 'text/plain',
    byteSize: 4,
    contentHash: 'pend',
    actorPersonId: owner.id,
    createdAt: old,
  })
  const joined = insertArtifactRow(store, {
    filename: 'kept.txt',
    mime: 'text/plain',
    byteSize: 4,
    contentHash: 'join',
    actorPersonId: owner.id,
    createdAt: old,
  })
  const user = insertMessage(store, {
    botId: bot.id,
    role: 'user',
    content: 'kept',
    personId: owner.id,
    viewer: { id: owner.id, role: 'owner' },
  })
  joinMessageArtifacts(store, user.id, [joined.id])
  const doomed = listPendingArtifactIds(store, Date.now())
  expect(doomed).toContain(pending.id)
  expect(doomed).not.toContain(joined.id)
  deleteArtifactRows(store, doomed)
  expect(getArtifact(store, pending.id)).toBeUndefined()
  expect(getArtifact(store, joined.id)?.id).toBe(joined.id)
})

it('lists orphans after a join is removed', () => {
  const store = memoryStore()
  const owner = createOwner(store, { email: 'owner@example.test', passwordHash: 'hash:owner' })
  const { bot } = createBot(store, { createdBy: owner.id })
  const artifact = insertArtifactRow(store, {
    filename: 'gone.txt',
    mime: 'text/plain',
    byteSize: 4,
    contentHash: 'gone',
    actorPersonId: owner.id,
  })
  const user = insertMessage(store, {
    botId: bot.id,
    role: 'user',
    content: 'later deleted',
    personId: owner.id,
    viewer: { id: owner.id, role: 'owner' },
  })
  joinMessageArtifacts(store, user.id, [artifact.id])
  store.sqlite.prepare('DELETE FROM messages WHERE id = ?').run(user.id)
  expect(listOrphanArtifactIds(store)).toContain(artifact.id)
})

it('does not require a temp dir helper to exist for compose', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dostigus-art-'))
  rmSync(dir, { recursive: true, force: true })
  expect(dir).toContain('dostigus-art-')
})
