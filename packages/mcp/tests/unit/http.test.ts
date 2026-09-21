import { openStore } from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import {
  authorizeMcpHttp,
  getPlatformMcpSurface,
  handleMcpJsonRpc,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  PLATFORM_TOOL_NAMES,
  readClusterMcpToken,
} from '../../src/index'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryCtx() {
  const store = openStore('file::memory:')
  opened.push(store)
  return { store }
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('treats an unset Cluster token as MCP endpoint off', () => {
  expect(readClusterMcpToken({})).toBeUndefined()
  expect(authorizeMcpHttp({ expectedToken: undefined, authorization: 'Bearer secret' })).toEqual({
    ok: false,
    status: 404,
    message: 'MCP surface is disabled',
  })
})

it('accepts DOSTIGUS_MCP_TOKEN or NUXT_AGENT_TOKEN', () => {
  expect(readClusterMcpToken({ DOSTIGUS_MCP_TOKEN: ' cluster-secret ' })).toBe('cluster-secret')
  expect(readClusterMcpToken({ NUXT_AGENT_TOKEN: 'nuxt-secret' })).toBe('nuxt-secret')
  expect(readClusterMcpToken({
    DOSTIGUS_MCP_TOKEN: 'primary',
    NUXT_AGENT_TOKEN: 'fallback',
  })).toBe('primary')
})

it('returns 401 when the Bearer token does not match', () => {
  expect(authorizeMcpHttp({
    expectedToken: 'cluster-secret',
    authorization: 'Bearer other',
  })).toEqual({
    ok: false,
    status: 401,
    message: 'Unauthorized',
  })
  expect(authorizeMcpHttp({
    expectedToken: 'cluster-secret',
    authorization: undefined,
  }).status).toBe(401)
  expect(authorizeMcpHttp({
    expectedToken: 'cluster-secret',
    authorization: 'Bearer cluster-secret',
  })).toEqual({ ok: true })
})

it('handles initialize, tools/list, and tools/call over JSON-RPC', async () => {
  const ctx = memoryCtx()
  const surface = getPlatformMcpSurface()

  const initialized = await handleMcpJsonRpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'test', version: '0' } },
  }, surface, ctx)
  expect(initialized.status).toBe(200)
  expect(initialized.body).toMatchObject({
    jsonrpc: '2.0',
    id: 1,
    result: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo: { name: MCP_SERVER_NAME },
    },
  })

  const notified = await handleMcpJsonRpc({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  }, surface, ctx)
  expect(notified).toEqual({ status: 202, body: null })

  const listed = await handleMcpJsonRpc({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
  }, surface, ctx)
  const names = (listed.body?.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name)
  expect(names).toEqual([...PLATFORM_TOOL_NAMES])

  const created = await handleMcpJsonRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'bots.create', arguments: { name: 'Via MCP' } },
  }, surface, ctx)
  expect(created.body?.result).toMatchObject({ isError: false })
  const payload = JSON.parse(
    (created.body?.result as { content: Array<{ text: string }> }).content[0]!.text,
  ) as { bot: { name: string } }
  expect(payload.bot.name).toBe('Via MCP')
})

it('returns a tool error result when bots.get misses', async () => {
  const ctx = memoryCtx()
  const result = await handleMcpJsonRpc({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'bots.get', arguments: { id: 'missing' } },
  }, getPlatformMcpSurface(), ctx)

  expect(result.body?.result).toMatchObject({
    isError: true,
    content: [{ type: 'text', text: 'Bot not found' }],
  })
})
