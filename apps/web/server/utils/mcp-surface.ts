/**
 * Kitchen Module tools. On `/mcp` and the Host Sheet.
 * Not in the Chat LLM loop. See ADR 0026.
 */
export const KITCHEN_MCP_TOOLS = [
  'dostigus_kitchen_pantry_list',
  'dostigus_kitchen_pantry_add',
  'dostigus_kitchen_cooked_mark',
  'dostigus_kitchen_recipe_get',
  'dostigus_kitchen_recipe_save',
] as const

export type KitchenMcpTool = typeof KITCHEN_MCP_TOOLS[number]

/** Platform MCP surface tool names (Host + Cluster Store). */
export const PLATFORM_MCP_TOOLS = [
  'dostigus_bots_list',
  'dostigus_bots_get',
  'dostigus_bots_create',
  'dostigus_bots_update',
  'dostigus_bots_delete',
  'dostigus_messages_list',
  'dostigus_messages_create',
  ...KITCHEN_MCP_TOOLS,
] as const

export type PlatformMcpTool = typeof PLATFORM_MCP_TOOLS[number]

type ChatExcludedMcpTool = 'dostigus_bots_delete' | KitchenMcpTool

/** Owner Chat LLM tool loop. Delete and Kitchen stay on `/mcp` and the Host. */
export const CHAT_MCP_TOOLS = PLATFORM_MCP_TOOLS.filter(
  (name): name is Exclude<PlatformMcpTool, ChatExcludedMcpTool> =>
    name !== 'dostigus_bots_delete' && !(KITCHEN_MCP_TOOLS as readonly string[]).includes(name),
)

export type ChatMcpTool = typeof CHAT_MCP_TOOLS[number]

/** Member Chat may read and append messages only. */
export const MEMBER_CHAT_MCP_TOOLS = [
  'dostigus_messages_list',
  'dostigus_messages_create',
] as const satisfies readonly ChatMcpTool[]

export type MemberChatMcpTool = typeof MEMBER_CHAT_MCP_TOOLS[number]

export function isChatMcpTool(name: string): name is ChatMcpTool {
  return (CHAT_MCP_TOOLS as readonly string[]).includes(name)
}

export function isMemberChatMcpTool(name: string): name is MemberChatMcpTool {
  return (MEMBER_CHAT_MCP_TOOLS as readonly string[]).includes(name)
}
