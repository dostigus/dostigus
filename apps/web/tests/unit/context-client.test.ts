import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import { afterEach, expect, it } from 'vitest'
import { callContextTool, contextMcpEndpoint } from '../../server/utils/context-client'

type Seen = {
  method?: string
  auth?: string | string[]
  session?: string | string[]
  body: { method?: string, params?: { name?: string, arguments?: Record<string, unknown> } }
}

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve())
  })))
})

function fakeContext(): Promise<{ url: string, seen: Seen[] }> {
  const seen: Seen[] = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      const body = JSON.parse(raw || '{}') as Seen['body']
      seen.push({
        method: body.method,
        auth: req.headers.authorization,
        session: req.headers['mcp-session-id'],
        body,
      })
      if (body.method === 'initialize') {
        res.setHeader('mcp-session-id', 'sess-1')
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { protocolVersion: '2025-03-26', capabilities: {} },
        }))
        return
      }
      if (body.method === 'notifications/initialized') {
        res.writeHead(202)
        res.end()
        return
      }
      const args = body.params?.arguments ?? {}
      const payload = {
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              projectCreated: body.params?.name === 'remember',
              project: args.project,
              scope: args.scope,
              mode: args.mode,
              query: args.query,
            }),
          }],
        },
      }
      res.setHeader('content-type', 'text/event-stream')
      res.end(`event: message\ndata: ${JSON.stringify(payload)}\n\n`)
    })
  })
  servers.push(server)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      resolve({ url: `http://127.0.0.1:${address.port}`, seen })
    })
  })
}

it('appends /mcp and does not duplicate it', () => {
  expect(contextMcpEndpoint('http://context.example')).toBe('http://context.example/mcp')
  expect(contextMcpEndpoint('http://context.example/mcp')).toBe('http://context.example/mcp')
  expect(() => contextMcpEndpoint('not a url')).toThrow(/invalid/i)
})

it('calls Context over streamable HTTP and keeps the bearer on the Host', async () => {
  const { url, seen } = await fakeContext()
  const pack = await callContextTool({ url, token: 'area-token' }, 'search', {
    scope: 'dostigus',
    project: 'dostigus',
    query: 'cut tickets',
    mode: 'pack',
    budgetBytes: 4096,
  }) as { project?: string, scope?: string, mode?: string }
  expect(pack).toMatchObject({
    project: 'dostigus',
    scope: 'dostigus',
    mode: 'pack',
  })
  expect(seen.map((call) => call.method)).toEqual(['initialize', 'notifications/initialized', 'tools/call'])
  expect(seen.every((call) => call.auth === 'Bearer area-token')).toBe(true)
  const toolCall = seen.find((call) => call.method === 'tools/call')
  expect(toolCall?.session).toBe('sess-1')
  expect(toolCall?.body.params?.arguments).toMatchObject({
    project: 'dostigus',
    scope: 'dostigus',
    mode: 'pack',
    budgetBytes: 4096,
  })
  expect(JSON.stringify(toolCall?.body)).not.toContain('area-token')
})
