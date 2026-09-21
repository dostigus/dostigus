import { z } from 'zod'
import { deleteClusterBot, withClusterStore } from '../../utils/cluster-bots'
import { mcpJson } from '../../utils/mcp'
import { mcpToolsEnabled } from '../../utils/mcp-auth'

export default defineMcpTool({
  name: 'dostigus_bots_delete',
  description: 'Delete a Bot and its Chat messages from the Cluster Store.',
  annotations: { destructiveHint: true },
  enabled: mcpToolsEnabled,
  inputSchema: {
    id: z.string().min(1),
  },
  handler: async ({ id }) => mcpJson(withClusterStore((store) => deleteClusterBot(store, id))),
})
