import { agentToken } from '../utils/env'
import { authorizeMcpAgent, readAuthorizationHeader } from '../utils/mcp-auth'

/**
 * Soft Bearer auth (toolkit docs): never throw 401 — clients treat it as OAuth.
 * Valid token → event.context.agentOk; tools gate via `enabled`.
 */
export default defineMcpHandler({
  middleware: async (event) => {
    authorizeMcpAgent(event, readAuthorizationHeader(event), agentToken())
  },
})
