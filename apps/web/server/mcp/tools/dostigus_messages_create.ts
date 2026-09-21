import { MESSAGE_ROLES } from '@dostigus/shared'
import { z } from 'zod'
import { appendClusterMessage, withClusterStore } from '../../utils/cluster-bots'
import { mcpJson } from '../../utils/mcp'
import { mcpToolsEnabled } from '../../utils/mcp-auth'

export default defineMcpTool({
  name: 'dostigus_messages_create',
  description: 'Append a Chat message to a Bot in the Cluster Store. Role is user, assistant, or system (default user). Does not call the LLM gateway.',
  enabled: mcpToolsEnabled,
  inputSchema: {
    botId: z.string().min(1),
    content: z.string().min(1),
    role: z.enum(MESSAGE_ROLES).optional(),
  },
  handler: async ({ botId, content, role }) => mcpJson(withClusterStore((store) => ({
    message: appendClusterMessage(store, {
      botId,
      role: role ?? 'user',
      content,
    }),
  }))),
})
