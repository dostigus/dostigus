import { z } from 'zod'
import { listClusterMessages, withClusterStore } from '../../utils/cluster-bots'
import { mcpJson } from '../../utils/mcp'
import { mcpToolsEnabled } from '../../utils/mcp-auth'

export default defineMcpTool({
  name: 'dostigus_messages_list',
  description: 'List Chat messages for a Bot in the Cluster Store, oldest first. Writes the assistant greeting if the Chat is empty.',
  enabled: mcpToolsEnabled,
  inputSchema: {
    botId: z.string().min(1),
  },
  handler: async ({ botId }) => mcpJson(withClusterStore((store) => listClusterMessages(store, botId))),
})
