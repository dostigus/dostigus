/** Platform MCP surface tool names (Host + Cluster Store). */
export const PLATFORM_MCP_TOOLS = [
  'dostigus_bots_list',
  'dostigus_bots_get',
  'dostigus_bots_create',
  'dostigus_bots_update',
  'dostigus_bots_delete',
  'dostigus_messages_list',
  'dostigus_messages_create',
] as const

export type PlatformMcpTool = typeof PLATFORM_MCP_TOOLS[number]
