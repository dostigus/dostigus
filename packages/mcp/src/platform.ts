import type { PlatformToolName } from './names'
import type { McpToolContext, PlatformMcpSurface, PlatformToolInputs, PlatformToolResults } from './types'
import { createPlatformMcpSurface } from './runtime'
import { platformTools } from './tools'

let surface: PlatformMcpSurface | undefined

/** Platform MCP surface (bots + Chat messages). Same verbs for Host and HTTP. */
export function getPlatformMcpSurface(): PlatformMcpSurface {
  surface ??= createPlatformMcpSurface(platformTools)
  return surface
}

export function invokePlatformTool<K extends PlatformToolName>(
  name: K,
  input: PlatformToolInputs[K],
  ctx: McpToolContext,
): Promise<PlatformToolResults[K]>
export function invokePlatformTool(
  name: string,
  input: unknown,
  ctx: McpToolContext,
): Promise<unknown>
export function invokePlatformTool(
  name: string,
  input: unknown,
  ctx: McpToolContext,
): Promise<unknown> {
  return getPlatformMcpSurface().invoke(name, input, ctx)
}

export function listPlatformTools() {
  return getPlatformMcpSurface().list()
}
