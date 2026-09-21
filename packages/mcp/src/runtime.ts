import type { PlatformToolName } from './names'
import type { McpToolContext, McpToolSpec, PlatformMcpSurface } from './types'
import { McpInvokeError, wrapToolError } from './errors'
import { PLATFORM_TOOL_NAMES } from './names'
import { toJsonSchema } from './schema'

type RegisteredTool = McpToolSpec & {
  handler: (input: unknown, ctx: McpToolContext) => unknown | Promise<unknown>
}

export function createPlatformMcpSurface(
  tools: Array<Omit<RegisteredTool, 'jsonSchema'> & { jsonSchema?: McpToolSpec['jsonSchema'] }>,
): PlatformMcpSurface {
  const registered = new Map<string, RegisteredTool>()

  for (const tool of tools) {
    registered.set(tool.name, {
      ...tool,
      jsonSchema: tool.jsonSchema ?? toJsonSchema(tool.inputSchema),
    })
  }

  return {
    tools: PLATFORM_TOOL_NAMES.filter((name) => registered.has(name)),
    list: () => PLATFORM_TOOL_NAMES
      .map((name) => registered.get(name))
      .filter((tool): tool is RegisteredTool => tool != null)
      .map(({ name, description, inputSchema, jsonSchema }) => ({
        name,
        description,
        inputSchema,
        jsonSchema,
      })),
    invoke: async (name, input, ctx) => {
      const tool = registered.get(name)
      if (!tool) {
        throw new McpInvokeError(`Unknown tool: ${name}`, 404, 'unknown_tool')
      }
      const parsed = tool.inputSchema.safeParse(input ?? {})
      if (!parsed.success) {
        const detail = parsed.error.issues.map((issue) => {
          const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
          return `${path}${issue.message}`
        }).join('; ')
        throw new McpInvokeError(detail || 'Invalid tool input', 400, 'validation')
      }
      try {
        return await tool.handler(parsed.data, ctx)
      } catch (error) {
        wrapToolError(error)
      }
    },
  }
}

export function isPlatformToolName(name: string): name is PlatformToolName {
  return (PLATFORM_TOOL_NAMES as readonly string[]).includes(name)
}
