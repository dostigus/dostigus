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

/** Chat LLM tool loop. Delete stays on `/mcp` and Host UI only. */
export const CHAT_MCP_TOOLS = PLATFORM_MCP_TOOLS.filter(
  (name): name is Exclude<PlatformMcpTool, 'dostigus_bots_delete'> =>
    name !== 'dostigus_bots_delete',
)

export type ChatMcpTool = typeof CHAT_MCP_TOOLS[number]

export function isChatMcpTool(name: string): name is ChatMcpTool {
  return (CHAT_MCP_TOOLS as readonly string[]).includes(name)
}
