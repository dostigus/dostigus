import type { McpToolContext, PlatformMcpSurface } from './types'
import { McpInvokeError } from './errors'

export const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const
export const MCP_PROTOCOL_VERSION = '2025-03-26'
export const MCP_SERVER_NAME = 'dostigus'
export const MCP_SERVER_VERSION = '0.0.0'

export type JsonRpcId = string | number | null

export type JsonRpcRequest = {
  jsonrpc?: string
  id?: JsonRpcId
  method?: string
  params?: unknown
}

export type JsonRpcError = {
  code: number
  message: string
  data?: unknown
}

export type JsonRpcResponse = {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: unknown
  error?: JsonRpcError
}

export type McpJsonRpcResult = {
  status: number
  body: JsonRpcResponse | null
}

const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602
const INTERNAL_ERROR = -32603

function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined
}

function ok(id: JsonRpcId, result: unknown): McpJsonRpcResult {
  return { status: 200, body: { jsonrpc: '2.0', id, result } }
}

function fail(id: JsonRpcId, code: number, message: string, data?: unknown): McpJsonRpcResult {
  return {
    status: 200,
    body: {
      jsonrpc: '2.0',
      id,
      error: data === undefined ? { code, message } : { code, message, data },
    },
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function negotiateProtocol(requested: unknown): string {
  if (typeof requested === 'string' && (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
    return requested
  }
  return MCP_PROTOCOL_VERSION
}

function toolsListResult(surface: PlatformMcpSurface) {
  return {
    tools: surface.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.jsonSchema,
    })),
  }
}

async function toolsCallResult(
  surface: PlatformMcpSurface,
  params: unknown,
  ctx: McpToolContext,
) {
  const body = asRecord(params)
  const name = typeof body.name === 'string' ? body.name : ''
  if (!name) {
    throw Object.assign(new Error('Tool name is required'), { rpc: INVALID_PARAMS })
  }
  const args = body.arguments === undefined ? {} : body.arguments
  const result = await surface.invoke(name, args, ctx)
  const text = JSON.stringify(result)
  return {
    content: [{ type: 'text', text }],
    structuredContent: result,
    isError: false,
  }
}

/**
 * Stateless Streamable HTTP JSON-RPC (MCP initialize / tools/list / tools/call).
 * Notifications return 202 with an empty body.
 */
export async function handleMcpJsonRpc(
  body: unknown,
  surface: PlatformMcpSurface,
  ctx: McpToolContext,
): Promise<McpJsonRpcResult> {
  if (body == null || typeof body !== 'object') {
    return fail(null, PARSE_ERROR, 'Parse error')
  }
  if (Array.isArray(body)) {
    return fail(null, INVALID_REQUEST, 'Batch JSON-RPC is not supported')
  }

  const request = body as JsonRpcRequest
  if (request.jsonrpc !== '2.0' || typeof request.method !== 'string' || request.method.length === 0) {
    const id = request.id === undefined ? null : request.id
    return fail(id, INVALID_REQUEST, 'Invalid request')
  }

  if (isNotification(request)) {
    return { status: 202, body: null }
  }

  const id = request.id ?? null

  try {
    switch (request.method) {
      case 'initialize': {
        const params = asRecord(request.params)
        return ok(id, {
          protocolVersion: negotiateProtocol(params.protocolVersion),
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: MCP_SERVER_NAME,
            version: MCP_SERVER_VERSION,
            title: 'Dostigus Cluster MCP surface',
          },
          instructions:
            'Platform tools for the Cluster Store. Host UI and Bots share bots.* and messages.*.',
        })
      }
      case 'ping':
        return ok(id, {})
      case 'tools/list':
        return ok(id, toolsListResult(surface))
      case 'tools/call':
        return ok(id, await toolsCallResult(surface, request.params, ctx))
      case 'resources/list':
        return ok(id, { resources: [] })
      case 'prompts/list':
        return ok(id, { prompts: [] })
      default:
        return fail(id, METHOD_NOT_FOUND, `Method not found: ${request.method}`)
    }
  } catch (error) {
    if (error instanceof McpInvokeError) {
      const text = error.message
      return ok(id, {
        content: [{ type: 'text', text }],
        isError: true,
      })
    }
    if (error instanceof Error && 'rpc' in error && typeof error.rpc === 'number') {
      return fail(id, error.rpc, error.message)
    }
    const message = error instanceof Error ? error.message : 'Internal error'
    return fail(id, INTERNAL_ERROR, message)
  }
}
