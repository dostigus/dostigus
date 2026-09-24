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

/** Schedule and Cluster timezone tools. On `/mcp` and the Chat loop. See ADR 0027. */
export const SCHEDULE_MCP_TOOLS = [
  'dostigus_schedules_list',
  'dostigus_schedules_create',
  'dostigus_schedules_update',
  'dostigus_schedules_pause',
  'dostigus_schedules_resume',
  'dostigus_schedules_delete',
  'dostigus_cluster_timezone_get',
  'dostigus_cluster_timezone_set',
] as const

/** Host HTTP get and Cluster http allowlist. On `/mcp` and the Chat loop. See ADR 0031. */
export const HTTP_MCP_TOOLS = [
  'dostigus_http_get',
  'dostigus_cluster_http_allowlist_get',
  'dostigus_cluster_http_allowlist_set',
] as const

export type HttpMcpTool = typeof HTTP_MCP_TOOLS[number]

/** Platform MCP surface tool names (Host + Cluster Store). */
export const SKILL_MCP_TOOLS = [
  'dostigus_skills_list',
  'dostigus_skills_read',
  'dostigus_skills_upsert',
  'dostigus_skills_delete',
] as const

export type SkillMcpTool = typeof SKILL_MCP_TOOLS[number]

export const SKILL_READ_MCP_TOOLS = [
  'dostigus_skills_list',
  'dostigus_skills_read',
] as const satisfies readonly SkillMcpTool[]

export const SKILL_WRITE_MCP_TOOLS = [
  'dostigus_skills_upsert',
  'dostigus_skills_delete',
] as const satisfies readonly SkillMcpTool[]

/**
 * Turn journal tools. On `/mcp` for an ops token.
 * Not in the Owner or Member Chat LLM loop. See ADR 0029.
 */
export const TURN_MCP_TOOLS = [
  'dostigus_turns_list',
  'dostigus_turns_get',
] as const

export type TurnMcpTool = typeof TURN_MCP_TOOLS[number]

export const PLATFORM_MCP_TOOLS = [
  'dostigus_bots_list',
  'dostigus_bots_get',
  'dostigus_bots_create',
  'dostigus_bots_update',
  'dostigus_bots_delete',
  ...SKILL_MCP_TOOLS,
  'dostigus_messages_list',
  'dostigus_messages_create',
  ...SCHEDULE_MCP_TOOLS,
  ...HTTP_MCP_TOOLS,
  ...TURN_MCP_TOOLS,
  ...KITCHEN_MCP_TOOLS,
] as const

export type PlatformMcpTool = typeof PLATFORM_MCP_TOOLS[number]

type ChatExcludedMcpTool = 'dostigus_bots_delete' | KitchenMcpTool | TurnMcpTool

/** Union of tools that may appear in Chat. Slim + expand. See ADR 0032. */
export const CHAT_MCP_TOOLS = PLATFORM_MCP_TOOLS.filter(
  (name): name is Exclude<PlatformMcpTool, ChatExcludedMcpTool> =>
    name !== 'dostigus_bots_delete'
    && !(KITCHEN_MCP_TOOLS as readonly string[]).includes(name)
    && !(TURN_MCP_TOOLS as readonly string[]).includes(name),
)

export type ChatMcpTool = typeof CHAT_MCP_TOOLS[number]

/**
 * Owner / creator-Member / grantee slim baseline. See ADR 0032.
 */
export const CHAT_SLIM_MCP_TOOLS = [
  'dostigus_messages_list',
  'dostigus_messages_create',
  'dostigus_schedules_list',
  'dostigus_schedules_create',
  'dostigus_schedules_update',
  'dostigus_schedules_pause',
  'dostigus_schedules_resume',
  'dostigus_schedules_delete',
  'dostigus_cluster_timezone_get',
  'dostigus_http_get',
  'dostigus_skills_list',
  'dostigus_skills_read',
] as const satisfies readonly ChatMcpTool[]

export type ChatSlimMcpTool = typeof CHAT_SLIM_MCP_TOOLS[number]

/** Owner expand adds these on a keyword hit. This turn only. */
export const OWNER_EXPAND_MCP_TOOLS = [
  'dostigus_bots_list',
  'dostigus_bots_get',
  'dostigus_bots_create',
  'dostigus_bots_update',
  'dostigus_skills_upsert',
  'dostigus_skills_delete',
  'dostigus_cluster_timezone_set',
  'dostigus_cluster_http_allowlist_get',
  'dostigus_cluster_http_allowlist_set',
] as const satisfies readonly ChatMcpTool[]

/** Creator-Member expand. Not bots_create, timezone set, or allowlist. */
export const CREATOR_EXPAND_MCP_TOOLS = [
  'dostigus_bots_update',
  'dostigus_skills_upsert',
  'dostigus_skills_delete',
] as const satisfies readonly ChatMcpTool[]

/** Wake: narrower than user slim. No Schedule writes, no bots_*, no expand. */
export const WAKE_CHAT_MCP_TOOLS = [
  'dostigus_http_get',
  'dostigus_skills_list',
  'dostigus_skills_read',
  'dostigus_schedules_list',
  'dostigus_messages_list',
  'dostigus_messages_create',
  'dostigus_cluster_timezone_get',
] as const satisfies readonly ChatMcpTool[]

/**
 * Every Member Chat turn, including a grantee. Slim baseline.
 * Manifest and Skill write wait for creator expand.
 */
export const MEMBER_CHAT_MCP_TOOLS = CHAT_SLIM_MCP_TOOLS

export type MemberChatMcpTool = typeof MEMBER_CHAT_MCP_TOOLS[number]

/**
 * A Member who created this Bot, after keyword expand.
 * Not bots_create, bots_delete, or appearance-only tools.
 */
export const CREATOR_MEMBER_CHAT_MCP_TOOLS = [
  ...MEMBER_CHAT_MCP_TOOLS,
  ...CREATOR_EXPAND_MCP_TOOLS,
] as const satisfies readonly ChatMcpTool[]

export type CreatorMemberChatMcpTool = typeof CREATOR_MEMBER_CHAT_MCP_TOOLS[number]

export function isChatMcpTool(name: string): name is ChatMcpTool {
  return (CHAT_MCP_TOOLS as readonly string[]).includes(name)
}

export function isMemberChatMcpTool(name: string): name is MemberChatMcpTool {
  return (MEMBER_CHAT_MCP_TOOLS as readonly string[]).includes(name)
}

export function isCreatorMemberChatMcpTool(name: string): name is CreatorMemberChatMcpTool {
  return (CREATOR_MEMBER_CHAT_MCP_TOOLS as readonly string[]).includes(name)
}

export type ChatTurnToolsInput = {
  role: 'owner' | 'member'
  canEditManifest?: boolean
  expand?: boolean
  wake?: boolean
}

export function chatToolNamesForTurn(input: ChatTurnToolsInput): readonly ChatMcpTool[] {
  if (input.wake) {
    return WAKE_CHAT_MCP_TOOLS
  }
  if (input.role === 'owner' && input.expand) {
    return CHAT_MCP_TOOLS
  }
  if (input.role === 'member' && input.canEditManifest && input.expand) {
    return CREATOR_MEMBER_CHAT_MCP_TOOLS
  }
  return CHAT_SLIM_MCP_TOOLS
}
