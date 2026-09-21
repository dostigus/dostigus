import { listClusterBots, withClusterStore } from '../../utils/cluster-bots'
import { mcpJson } from '../../utils/mcp'
import { mcpToolsEnabled } from '../../utils/mcp-auth'

export default defineMcpTool({
  name: 'dostigus_bots_list',
  description: 'List Bots in the Cluster Store, newest first. Each Bot includes id, name, createdAt, and Manifest (modelTier, skillIds, modulePackageIds).',
  annotations: { readOnlyHint: true },
  enabled: mcpToolsEnabled,
  handler: async () => mcpJson(withClusterStore(listClusterBots)),
})
