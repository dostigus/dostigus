/** Stable MCP contract verbs for the day-1 platform MCP surface. */
export const PLATFORM_TOOL_NAMES = [
  'bots.list',
  'bots.get',
  'bots.create',
  'bots.update',
  'bots.delete',
  'messages.list',
  'messages.create',
] as const

export type PlatformToolName = (typeof PLATFORM_TOOL_NAMES)[number]
