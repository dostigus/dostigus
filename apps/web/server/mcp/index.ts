import { findProjectIdByToken } from '@dostigus/db'
import { useStore } from '../utils/cluster-store'
import { agentToken } from '../utils/env'
import { authorizeMcpAgent, bearerMatches, bearerToken, readAuthorizationHeader, setMcpCaller } from '../utils/mcp-auth'

/**
 * Soft Bearer auth (toolkit docs): never throw 401 — clients treat it as OAuth.
 * The owner token (NUXT_AGENT_TOKEN) sets agentOk. A Project token sets
 * mcpCaller only, so existing Cluster tools stay disabled. See ADR 0052.
 */
export default defineMcpHandler({
  middleware: async (event) => {
    const header = readAuthorizationHeader(event)
    const owner = agentToken()
    authorizeMcpAgent(event, header, owner)
    const bearer = bearerToken(header)
    if (!bearer) {
      return
    }
    if (owner && bearerMatches(bearer, owner)) {
      setMcpCaller(event, { kind: 'owner' })
      return
    }
    const projectId = findProjectIdByToken(useStore(), bearer)
    if (projectId) {
      setMcpCaller(event, { kind: 'project', projectId })
    }
  },
})
