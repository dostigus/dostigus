import { MODEL_TIERS } from '@dostigus/shared'
import { z } from 'zod'
import { createClusterBot, withClusterStore } from '../../utils/cluster-bots'
import { mcpJson } from '../../utils/mcp'
import { mcpToolsEnabled } from '../../utils/mcp-auth'

export default defineMcpTool({
  name: 'dostigus_bots_create',
  description: 'Create a Bot in the Cluster Store. Optional name (default New Bot) and Model tier (default strong). Stores an assistant greeting that asks what the Bot is for.',
  enabled: mcpToolsEnabled,
  inputSchema: {
    name: z.string().optional(),
    modelTier: z.enum(MODEL_TIERS).optional(),
  },
  handler: async (input) => mcpJson(withClusterStore((store) => createClusterBot(store, input))),
})
