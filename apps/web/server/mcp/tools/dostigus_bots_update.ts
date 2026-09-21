import { MODEL_TIERS } from '@dostigus/shared'
import { z } from 'zod'
import { updateClusterBot, withClusterStore } from '../../utils/cluster-bots'
import { mcpJson } from '../../utils/mcp'
import { mcpToolsEnabled } from '../../utils/mcp-auth'

export default defineMcpTool({
  name: 'dostigus_bots_update',
  description: 'Update a Bot name and/or Model tier in the Cluster Store.',
  enabled: mcpToolsEnabled,
  inputSchema: {
    id: z.string().min(1),
    name: z.string().optional(),
    modelTier: z.enum(MODEL_TIERS).optional(),
  },
  handler: async ({ id, name, modelTier }) => mcpJson(withClusterStore((store) => (
    updateClusterBot(store, id, { name, modelTier })
  ))),
})
