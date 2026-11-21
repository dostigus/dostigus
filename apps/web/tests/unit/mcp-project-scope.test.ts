import type { ChildProcess } from 'node:child_process'
import type { AddressInfo } from 'node:net'
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { Agent, createServer, request as httpRequest } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createOwner, createProject, issueProjectToken, openStore } from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'

const children: ChildProcess[] = []

afterEach(() => {
  for (const child of children.splice(0)) {
    child.kill('SIGTERM')
  }
})

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      server.close(() => resolve(address.port))
    })
    server.on('error', reject)
  })
}

function postMcp(agent: Agent, port: number, token: string, body: unknown) {
  return new Promise<{ status: number, json: { result?: { tools?: Array<{ name: string }>, content?: Array<{ text?: string }> }, error?: { message?: string } }, localPort?: number }>((resolve, reject) => {
    const req = httpRequest({
      host: '127.0.0.1',
      port,
      path: '/mcp',
      method: 'POST',
      agent,
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        'connection': 'keep-alive',
      },
    }, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        raw += chunk
      })
      res.on('end', () => {
        let json: { result?: { tools?: Array<{ name: string }>, content?: Array<{ text?: string }> }, error?: { message?: string } } = {}
        try {
          json = JSON.parse(raw || '{}') as typeof json
        } catch {
          reject(new Error(`MCP response was not JSON: ${raw.slice(0, 200)}`))
          return
        }
        resolve({ status: res.statusCode ?? 0, json, localPort: res.socket?.localPort })
      })
    })
    req.on('error', reject)
    req.end(JSON.stringify(body))
  })
}

async function waitForHealth(port: number, child: ChildProcess) {
  const deadline = Date.now() + 120_000
  let log = ''
  child.stdout?.on('data', (chunk) => {
    log += chunk
  })
  child.stderr?.on('data', (chunk) => {
    log += chunk
  })
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`)
      if (response.ok) {
        return
      }
    } catch {
      // The dev server is still binding.
    }
    if (child.exitCode != null) {
      throw new Error(`Host exited ${child.exitCode}: ${log.slice(-2000)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`Host did not answer /health. ${log.slice(-2000)}`)
}

it('scopes two Project tokens on one keep-alive connection', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dostigus-mcp-'))
  const databaseUrl = `file:${join(dir, 'cluster.sqlite')}`
  const store = openStore(databaseUrl)
  createOwner(store, { username: 'nick', passwordHash: 'hash:nick' })
  const first = createProject(store, { kind: 'owner' }, { name: 'Dostigus', slug: 'dostigus' })
  const second = createProject(store, { kind: 'owner' }, { name: 'Inherit', slug: 'inherit' })
  const tokenA = issueProjectToken(store, first.id, 'A').token
  const tokenB = issueProjectToken(store, second.id, 'B').token
  store.close()

  const port = await freePort()
  const child = spawn('pnpm', ['--filter', '@dostigus/web', 'exec', 'nuxi', 'dev', '--port', String(port), '--host', '127.0.0.1'], {
    cwd: join(import.meta.dirname, '../../../..'),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NUXT_AGENT_TOKEN: 'owner-scope-token',
      NUXT_SESSION_PASSWORD: 'abcdefghijklmnopqrstuvwxyz012345',
      NUXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.push(child)
  await waitForHealth(port, child)

  const agent = new Agent({ keepAlive: true, maxSockets: 1 })
  const listBody = { jsonrpc: '2.0', id: 1, method: 'tools/list' }
  const listedA = await postMcp(agent, port, tokenA, listBody)
  const namesA = listedA.json.result?.tools?.map((tool) => tool.name) ?? []
  expect(namesA).toContain('dostigus_projects_list')
  expect(namesA).not.toContain('dostigus_bots_list')

  const projectsA = await postMcp(agent, port, tokenA, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'dostigus_projects_list', arguments: {} },
  })
  const textA = projectsA.json.result?.content?.[0]?.text ?? ''
  expect(textA).toContain(first.id)
  expect(textA).not.toContain(second.id)

  const listedB = await postMcp(agent, port, tokenB, listBody)
  const namesB = listedB.json.result?.tools?.map((tool) => tool.name) ?? []
  expect(namesB).toContain('dostigus_projects_list')
  expect(namesB).not.toContain('dostigus_bots_list')
  expect(listedB.localPort).toBe(listedA.localPort)

  const projectsB = await postMcp(agent, port, tokenB, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'dostigus_projects_list', arguments: {} },
  })
  const textB = projectsB.json.result?.content?.[0]?.text ?? ''
  expect(textB).toContain(second.id)
  expect(textB).not.toContain(first.id)
  agent.destroy()
}, 180_000)
