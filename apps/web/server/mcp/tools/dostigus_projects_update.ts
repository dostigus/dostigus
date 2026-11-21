import { factoryToolsEnabled } from '../../utils/mcp-auth'
import { registeredMcpToolOptions } from '../../utils/mcp-platform-tools'

export default defineMcpTool({
  ...registeredMcpToolOptions('dostigus_projects_update'),
  enabled: factoryToolsEnabled,
})
