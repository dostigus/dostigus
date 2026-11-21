import { factoryToolsEnabled } from '../../utils/mcp-auth'
import { registeredMcpToolOptions } from '../../utils/mcp-platform-tools'

export default defineMcpTool({
  ...registeredMcpToolOptions('dostigus_tasks_update'),
  enabled: factoryToolsEnabled,
})
