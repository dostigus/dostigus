import type { FactoryCaller, OpenedStore } from '@dostigus/db'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import {
  createOwner,
  createProject,
  createTask,
  insertArtifactRow,
  openStore,
} from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import { CONTEXT_NOT_CONFIGURED } from '../../server/utils/context-client'
import {
  proxyContextRead,
  proxyContextRemember,
  proxyContextSearch,
} from '../../server/utils/factory-mcp-tools'
import { factoryToolsEnabled } from '../../server/utils/mcp-auth'
import { platformToolSpec } from '../../server/utils/mcp-platform-tools'

const opened: Array<OpenedStore> = []
const servers: Server[] = []

function asCaller(caller: FactoryCaller) {
  return { factoryCaller: caller }
}

function tool(store: OpenedStore, caller: FactoryCaller, name: Parameters<typeof platformToolSpec>[0], input: Record<string, unknown>) {
  return platformToolSpec(name).run(input, store, undefined, asCaller(caller))
}

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  createOwner(store, { username: 'nick', passwordHash: 'hash:nick' })
  return store
}

afterEach(async () => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve())
  })))
})

function fakeContext(rememberId = 'dostigus') {
  const seen: Array<Record<string, unknown>> = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      const body = JSON.parse(raw || '{}') as {
        method?: string
        params?: { name?: string, arguments?: Record<string, unknown> }
      }
      if (body.method === 'tools/call') {
        seen.push(body.params?.arguments ?? {})
      }
      if (body.method === 'initialize') {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-03-26' } }))
        return
      }
      if (body.method === 'notifications/initialized') {
        res.writeHead(202)
        res.end()
        return
      }
      const args = body.params?.arguments ?? {}
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              projectCreated: body.params?.name === 'remember',
              project: args.project ?? rememberId,
              query: args.query,
            }),
          }],
        },
      }))
    })
  })
  servers.push(server)
  return new Promise<{ url: string, seen: Array<Record<string, unknown>> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      resolve({ url: `http://127.0.0.1:${address.port}/mcp`, seen })
    })
  })
}

function fakeRead(payload: unknown) {
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      const body = JSON.parse(raw || '{}') as { method?: string }
      if (req.method === 'DELETE') {
        res.writeHead(200)
        res.end()
        return
      }
      if (body.method === 'initialize') {
        res.setHeader('mcp-session-id', 'sess-read')
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-03-26' } }))
        return
      }
      if (body.method === 'notifications/initialized') {
        res.writeHead(202)
        res.end()
        return
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
      }))
    })
  })
  servers.push(server)
  return new Promise<{ url: string }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      resolve({ url: `http://127.0.0.1:${address.port}/mcp` })
    })
  })
}

it('lets the owner token see every Project and a Project token see one', () => {
  const store = memoryStore()
  const owner: FactoryCaller = { kind: 'owner' }
  const created = tool(store, owner, 'dostigus_projects_create', {
    name: 'Dostigus',
    slug: 'dostigus',
  }) as { project: { id: string } }
  tool(store, owner, 'dostigus_projects_create', { name: 'Inherit', slug: 'inherit' })
  const first = created.project.id
  const ownerList = tool(store, owner, 'dostigus_projects_list', {}) as { projects: Array<{ id: string }> }
  expect(ownerList.projects).toHaveLength(2)

  const project: FactoryCaller = { kind: 'project', projectId: first }
  const listed = tool(store, project, 'dostigus_projects_list', {}) as { projects: Array<{ id: string }> }
  expect(listed.projects.map((item) => item.id)).toEqual([first])
  expect(() => tool(store, project, 'dostigus_projects_create', { name: 'Other' })).toThrow(/Owner token/)
  const task = tool(store, project, 'dostigus_tasks_create', {
    projectId: first,
    title: 'Cut tickets',
    mode: 'feature',
  }) as { task: { id: string, status: string } }
  const moved = tool(store, project, 'dostigus_tasks_transition', {
    taskId: task.task.id,
    status: 'grilling',
  }) as { task: { status: string } }
  expect(moved.task.status).toBe('grilling')
  expect(() => tool(store, project, 'dostigus_tasks_transition', {
    taskId: task.task.id,
    status: 'released',
  })).toThrow(/Owner can release/)
  const ticket = tool(store, project, 'dostigus_tickets_create', {
    taskId: task.task.id,
    title: 'Schema',
    brief: 'Tables',
  }) as { ticket: { taskId: string } }
  expect(ticket.ticket.taskId).toBe(task.task.id)

  const other = createProject(store, { kind: 'owner' }, { name: 'Mailer', slug: 'mailer' })
  expect(() => tool(store, project, 'dostigus_tasks_list', { projectId: other.id })).toThrow(/scoped to another Project/)
})

it('returns Context not configured when the env is absent', async () => {
  const store = memoryStore()
  const project = createProject(store, { kind: 'owner' }, { name: 'Dostigus', slug: 'dostigus' })
  const result = await proxyContextSearch(store, { query: 'board', mode: 'pack' }, {
    config: null,
    caller: { kind: 'project', projectId: project.id },
  })
  expect(result).toEqual({ error: CONTEXT_NOT_CONFIGURED })
})

it('creates the Context project on the first remember and injects it into a pack', async () => {
  const store = memoryStore()
  const project = createProject(store, { kind: 'owner' }, { name: 'Dostigus', slug: 'dostigus' })
  const { url, seen } = await fakeContext()
  const caller: FactoryCaller = { kind: 'project', projectId: project.id }
  const config = { url, token: 'area-token' }
  const remembered = await proxyContextRemember(store, { text: 'The board is Tasks.' }, { config, fetchImpl: fetch, caller })
  expect(remembered).toMatchObject({ projectCreated: true })
  const early = await proxyContextSearch(store, { query: 'board', mode: 'pack' }, { config, fetchImpl: fetch, caller })
  expect(early).toMatchObject({ query: 'board' })
  const again = createTask(store, { kind: 'owner' }, project.id, { title: 'Pack', mode: 'feature' })
  expect(again.projectId).toBe(project.id)
  const stored = tool(store, { kind: 'owner' }, 'dostigus_projects_get', { projectId: project.id }) as {
    project: { contextProjectId: string | null }
  }
  expect(stored.project.contextProjectId).toBe('dostigus')
  const rememberArgs = seen.find((args) => Array.isArray(args.project))
  expect(rememberArgs).toMatchObject({
    scope: 'dostigus',
    project: ['dostigus'],
    projectName: 'Dostigus',
  })
  expect(rememberArgs).not.toHaveProperty('token')
  await expect(proxyContextRead(store, { id: 'profile:inherit' }, { config, fetchImpl: fetch, caller })).rejects.toThrow(/scoped to another Project/)
})

it('does not enable factory tools from the owner-agent flag alone', () => {
  const event = { context: { agentOk: true, mcpCaller: undefined as { kind: 'project', projectId: string } | undefined } }
  expect(factoryToolsEnabled(event)).toBe(false)
  event.context.mcpCaller = { kind: 'project', projectId: 'dostigus' }
  expect(factoryToolsEnabled(event)).toBe(true)
})

it('refuses a Project token attaching an Artifact from outside its Project', async () => {
  const store = memoryStore()
  const project = createProject(store, { kind: 'owner' }, { name: 'Dostigus', slug: 'dostigus' })
  const task = createTask(store, { kind: 'owner' }, project.id, { title: 'Board', mode: 'feature' })
  const foreign = insertArtifactRow(store, {
    filename: 'other.png',
    mime: 'image/png',
    byteSize: 8,
    contentHash: 'other',
    actorPersonId: project.ownerId,
  })
  await expect(tool(store, { kind: 'project', projectId: project.id }, 'dostigus_tasks_attach', {
    taskId: task.id,
    artifactId: foreign.id,
  })).rejects.toThrow(/scoped to another Project/)
})

it('refuses a Context read that is not linked to this Project', async () => {
  const store = memoryStore()
  const project = createProject(store, { kind: 'owner' }, { name: 'Dostigus', slug: 'dostigus' })
  const caller: FactoryCaller = { kind: 'project', projectId: project.id }
  const foreign = await fakeRead({
    associations: [{ projectId: 'inherit', origin: 'client', status: 'linked' }],
  })
  await proxyContextRemember(store, { text: 'Remember the board.' }, {
    config: { url: foreign.url, token: 'area-token' },
    fetchImpl: fetch,
    caller,
  })
  await expect(proxyContextRead(store, { id: 'source-1' }, {
    config: { url: foreign.url, token: 'area-token' },
    fetchImpl: fetch,
    caller,
  })).rejects.toThrow(/scoped to another Project/)
  const linked = await fakeRead({
    associations: [{ projectId: 'dostigus', origin: 'client', status: 'linked' }],
  })
  const ok = await proxyContextRead(store, { id: 'source-1' }, {
    config: { url: linked.url, token: 'area-token' },
    fetchImpl: fetch,
    caller,
  })
  expect(ok).toMatchObject({ associations: [{ projectId: 'dostigus' }] })
})
