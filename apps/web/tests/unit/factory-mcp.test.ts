import type { OpenedStore } from '@dostigus/db'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import {
  createOwner,
  createProject,
  createTask,
  openStore,
} from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import { CONTEXT_NOT_CONFIGURED } from '../../server/utils/context-client'
import {
  proxyContextRead,
  proxyContextRemember,
  proxyContextSearch,
} from '../../server/utils/factory-mcp-tools'
import { factoryToolsEnabled, runWithMcpCaller } from '../../server/utils/mcp-auth'
import { platformToolSpec } from '../../server/utils/mcp-platform-tools'

const opened: Array<OpenedStore> = []
const servers: Server[] = []

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

it('lets the owner token see every Project and a Project token see one', () => {
  const store = memoryStore()
  const first = runWithMcpCaller({ kind: 'owner' }, () => {
    const created = platformToolSpec('dostigus_projects_create').run({
      name: 'Dostigus',
      slug: 'dostigus',
    }, store) as { project: { id: string } }
    platformToolSpec('dostigus_projects_create').run({ name: 'Inherit', slug: 'inherit' }, store)
    return created.project.id
  })
  const ownerList = runWithMcpCaller({ kind: 'owner' }, () => {
    return platformToolSpec('dostigus_projects_list').run({}, store) as { projects: Array<{ id: string }> }
  })
  expect(ownerList.projects).toHaveLength(2)

  const scoped = runWithMcpCaller({ kind: 'project', projectId: first }, () => {
    const listed = platformToolSpec('dostigus_projects_list').run({}, store) as { projects: Array<{ id: string }> }
    expect(listed.projects.map((item) => item.id)).toEqual([first])
    expect(() => platformToolSpec('dostigus_projects_create').run({ name: 'Other' }, store)).toThrow(/Owner token/)
    const task = platformToolSpec('dostigus_tasks_create').run({
      projectId: first,
      title: 'Cut tickets',
      mode: 'feature',
    }, store) as { task: { id: string, status: string } }
    const moved = platformToolSpec('dostigus_tasks_transition').run({
      taskId: task.task.id,
      status: 'grilling',
    }, store) as { task: { status: string } }
    expect(moved.task.status).toBe('grilling')
    const ticket = platformToolSpec('dostigus_tickets_create').run({
      taskId: task.task.id,
      title: 'Schema',
      brief: 'Tables',
    }, store) as { ticket: { taskId: string } }
    expect(ticket.ticket.taskId).toBe(task.task.id)
    return task.task.id
  })

  const other = createProject(store, { kind: 'owner' }, { name: 'Mailer', slug: 'mailer' })
  expect(() => runWithMcpCaller({ kind: 'project', projectId: first }, () => {
    platformToolSpec('dostigus_tasks_list').run({ projectId: other.id }, store)
  })).toThrow(/scoped to another Project/)
  expect(scoped).toBeTruthy()
})

it('returns Context not configured when the env is absent', async () => {
  const store = memoryStore()
  const project = createProject(store, { kind: 'owner' }, { name: 'Dostigus', slug: 'dostigus' })
  const result = await runWithMcpCaller({ kind: 'project', projectId: project.id }, () => {
    return proxyContextSearch(store, { query: 'board', mode: 'pack' }, { env: {} })
  })
  expect(result).toEqual({ error: CONTEXT_NOT_CONFIGURED })
})

it('creates the Context project on the first remember and injects it into a pack', async () => {
  const store = memoryStore()
  const project = createProject(store, { kind: 'owner' }, { name: 'Dostigus', slug: 'dostigus' })
  const { url, seen } = await fakeContext()
  const env = { NUXT_CONTEXT_URL: url, NUXT_CONTEXT_TOKEN: 'area-token' }
  await runWithMcpCaller({ kind: 'project', projectId: project.id }, async () => {
    const remembered = await proxyContextRemember(store, { text: 'The board is Tasks.' }, { env, fetchImpl: fetch })
    expect(remembered).toMatchObject({ projectCreated: true })
    const early = await proxyContextSearch(store, { query: 'board', mode: 'pack' }, { env, fetchImpl: fetch })
    expect(early).toMatchObject({ query: 'board' })
  })
  const again = createTask(store, { kind: 'owner' }, project.id, { title: 'Pack', mode: 'feature' })
  expect(again.projectId).toBe(project.id)
  const stored = runWithMcpCaller({ kind: 'owner' }, () => {
    return platformToolSpec('dostigus_projects_get').run({ projectId: project.id }, store) as {
      project: { contextProjectId: string | null }
    }
  })
  expect(stored.project.contextProjectId).toBe('dostigus')
  const rememberArgs = seen.find((args) => Array.isArray(args.project))
  expect(rememberArgs).toMatchObject({
    scope: 'dostigus',
    project: ['dostigus'],
    projectName: 'Dostigus',
  })
  expect(rememberArgs).not.toHaveProperty('token')
  const denied = runWithMcpCaller({ kind: 'project', projectId: project.id }, () => {
    return proxyContextRead(store, { id: 'profile:inherit' }, { env, fetchImpl: fetch })
  })
  await expect(denied).rejects.toThrow(/scoped to another Project/)
})

it('does not enable factory tools from the owner-agent flag alone', () => {
  const event = { context: { agentOk: true, mcpCaller: undefined as { kind: 'project', projectId: string } | undefined } }
  expect(factoryToolsEnabled(event)).toBe(false)
  event.context.mcpCaller = { kind: 'project', projectId: 'dostigus' }
  expect(factoryToolsEnabled(event)).toBe(true)
})
