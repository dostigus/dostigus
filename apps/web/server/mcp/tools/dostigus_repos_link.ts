import { factoryToolsEnabled } from '../../utils/mcp-auth'
import { registeredMcpToolOptions } from '../../utils/mcp-platform-tools'

export default defineMcpTool({
  ...registeredMcpToolOptions('dostigus_repos_link'),
  enabled: factoryToolsEnabled,
})
