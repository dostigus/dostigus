import {
  authorizeMcpHttp,
  getPlatformMcpSurface,
  handleMcpJsonRpc,
  readClusterMcpToken,
} from '@dostigus/mcp'

/**
 * Stateless Streamable HTTP MCP endpoint for the Cluster MCP surface.
 * Off until DOSTIGUS_MCP_TOKEN or NUXT_AGENT_TOKEN is set.
 */
export default defineEventHandler(async (event) => {
  const auth = authorizeMcpHttp({
    expectedToken: readClusterMcpToken(),
    authorization: getHeader(event, 'authorization'),
  })
  if (!auth.ok) {
    throw createError({
      statusCode: auth.status,
      statusMessage: auth.message,
    })
  }

  if (event.method === 'GET' || event.method === 'DELETE') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    })
  }

  if (event.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    })
  }

  const body = await readBody(event).catch(() => null)
  const result = await handleMcpJsonRpc(body, getPlatformMcpSurface(), { store: useStore() })
  setResponseStatus(event, result.status)
  if (result.body == null) {
    return null
  }
  return result.body
})
