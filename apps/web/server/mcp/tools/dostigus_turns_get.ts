import { mcpToolsEnabled } from '../../utils/mcp-auth'
import { registeredMcpToolOptions } from '../../utils/mcp-platform-tools'

export default defineMcpTool({
  ...registeredMcpToolOptions('dostigus_turns_get'),
  enabled: mcpToolsEnabled,
})
