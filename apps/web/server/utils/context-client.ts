import process from 'node:process'

/**
 * Host client for the Context MCP surface. The URL comes from
 * NUXT_CONTEXT_URL. Docs do not name a host. See ADR 0052.
 */
export class ContextClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContextClientError'
  }
}

export const CONTEXT_NOT_CONFIGURED = 'Context not configured'
export const CONTEXT_SCOPE = 'dostigus'
export const CONTEXT_PACK_BUDGET_MIN = 512
export const CONTEXT_PACK_BUDGET_MAX = 65_536
export const CONTEXT_PACK_BUDGET_DEFAULT = 8192

export type ContextConfig = {
  url: string
  token: string
}

type JsonRpc = {
  jsonrpc?: string
  id?: number
  result?: unknown
  error?: { message?: string }
}

export function contextConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ContextConfig | null {
  const url = env.NUXT_CONTEXT_URL?.trim() ?? ''
  const token = env.NUXT_CONTEXT_TOKEN?.trim() ?? ''
  if (!url || !token) {
    return null
  }
  return { url, token }
}

/** Append `/mcp` when the configured URL is the origin or another path. */
export function contextMcpEndpoint(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ContextClientError('Context URL is invalid')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ContextClientError('Context URL is invalid')
  }
  if (!url.pathname.endsWith('/mcp')) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/mcp`
  }
  return url.toString()
}

export async function callContextTool(
  config: ContextConfig,
  name: string,
  args: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const endpoint = contextMcpEndpoint(config.url)
  const init = await postRpc(endpoint, config.token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'dostigus-host', version: '0.0.0' },
    },
  }, undefined, fetchImpl)
  if (init.message.error) {
    throw new ContextClientError(init.message.error.message || 'Context initialize failed')
  }
  await postRpc(endpoint, config.token, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  }, init.session, fetchImpl)
  const called = await postRpc(endpoint, config.token, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name, arguments: args },
  }, init.session, fetchImpl)
  if (called.message.error) {
    throw new ContextClientError(called.message.error.message || 'Context tool failed')
  }
  return unwrapToolResult(called.message.result)
}

async function postRpc(
  endpoint: string,
  token: string,
  body: Record<string, unknown>,
  session: string | undefined,
  fetchImpl: typeof fetch,
): Promise<{ message: JsonRpc, session?: string }> {
  let response: Response
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        ...(session ? { 'mcp-session-id': session } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ContextClientError('Context did not respond')
  }
  const nextSession = response.headers.get('mcp-session-id') ?? session
  if (body.method === 'notifications/initialized') {
    if (!response.ok && response.status !== 202) {
      throw new ContextClientError('Context initialize failed')
    }
    return { message: {}, session: nextSession ?? undefined }
  }
  const text = await response.text()
  if (!response.ok) {
    throw new ContextClientError(text.trim() || 'Context tool failed')
  }
  const id = typeof body.id === 'number' ? body.id : undefined
  return { message: parseRpc(text, response.headers.get('content-type') ?? '', id), session: nextSession ?? undefined }
}

function parseRpc(text: string, contentType: string, id: number | undefined): JsonRpc {
  if (contentType.includes('text/event-stream')) {
    return parseSse(text, id)
  }
  try {
    return JSON.parse(text) as JsonRpc
  } catch {
    throw new ContextClientError('Context returned no result')
  }
}

function parseSse(text: string, id: number | undefined): JsonRpc {
  const events: string[] = []
  let data: string[] = []
  const flush = () => {
    if (data.length > 0) {
      events.push(data.join('\n'))
      data = []
    }
  }
  for (const line of text.split(/\r?\n/)) {
    if (line === '') {
      flush()
      continue
    }
    if (line.startsWith('data:')) {
      data.push(line.slice(5).replace(/^ /, ''))
    }
  }
  flush()
  for (const event of events) {
    let parsed: JsonRpc
    try {
      parsed = JSON.parse(event) as JsonRpc
    } catch {
      continue
    }
    if (id === undefined || parsed.id === id) {
      return parsed
    }
  }
  throw new ContextClientError('Context returned no result')
}

function unwrapToolResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') {
    return result
  }
  const record = result as {
    isError?: boolean
    content?: Array<{ type?: string, text?: string }>
    structuredContent?: unknown
  }
  const text = record.content?.find((item) => item.type === 'text')?.text
  if (record.isError) {
    throw new ContextClientError(errorText(text))
  }
  if (record.structuredContent !== undefined) {
    return record.structuredContent
  }
  if (typeof text === 'string') {
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }
  return result
}

function errorText(text: string | undefined): string {
  if (!text?.trim()) {
    return 'Context tool failed'
  }
  try {
    const parsed = JSON.parse(text) as { message?: string, error?: string }
    return parsed.message || parsed.error || text
  } catch {
    return text
  }
}
