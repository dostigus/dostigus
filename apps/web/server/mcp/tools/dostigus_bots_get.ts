import { z } from 'zod'
import { getClusterBot, withClusterStore } from '../../utils/cluster-bots'
import { mcpJson } from '../../utils/mcp'
import { mcpToolsEnabled } from '../../utils/mcp-auth'

export default defineMcpTool({
  name: 'dostigus_bots_get',
  description: 'Get one Bot from the Cluster Store by id, including its Manifest.',
  annotations: { readOnlyHint: true },
  enabled: mcpToolsEnabled,
  inputSchema: {
    id: z.string().min(1),
  },
  handler: async ({ id }) => mcpJson(withClusterStore((store) => getClusterBot(store, id))),
})
