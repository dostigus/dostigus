import type { ZodRawShape } from 'zod'
import { z } from 'zod'

export type OpenAiJsonSchemaObject = {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties: boolean
}

export type OpenAiChatFunctionTool = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: OpenAiJsonSchemaObject
  }
}

export type OpenAiToolCall = {
  id: string
  type?: string
  function?: {
    name?: string
    arguments?: string
  }
}

export type OpenAiChatMessage
  = | { role: 'system' | 'user' | 'assistant', content: string }
    | { role: 'assistant', content: string | null, tool_calls: OpenAiToolCall[] }
    | { role: 'tool', tool_call_id: string, content: string }

export type MappableMcpTool = {
  name: string
  description: string
  inputSchema?: ZodRawShape
}

/** Map a toolkit Zod shape to an OpenAI function `parameters` object. */
export function zodShapeToOpenAiParameters(
  shape?: ZodRawShape,
): OpenAiJsonSchemaObject {
  const json = z.toJSONSchema(z.object(shape ?? {}), {
    target: 'draft-07',
    io: 'input',
  }) as {
    properties?: Record<string, unknown>
    required?: string[]
  }
  return {
    type: 'object',
    properties: json.properties ?? {},
    ...(json.required?.length ? { required: json.required } : {}),
    additionalProperties: false,
  }
}

export function mcpToolsToOpenAiFunctions(
  tools: readonly MappableMcpTool[],
): OpenAiChatFunctionTool[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodShapeToOpenAiParameters(tool.inputSchema),
    },
  }))
}

export function parseToolCallArguments(raw: unknown): unknown {
  if (raw == null || raw === '') {
    return {}
  }
  if (typeof raw === 'object') {
    return raw
  }
  if (typeof raw !== 'string') {
    throw new TypeError('invalid tool arguments')
  }
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new Error('invalid tool arguments JSON')
  }
}

export function toolResultError(message: string): string {
  return JSON.stringify({ error: message })
}

export function collectToolCalls(message: {
  tool_calls?: OpenAiToolCall[] | null
} | undefined): OpenAiToolCall[] {
  return message?.tool_calls?.filter((call) => Boolean(call?.id)) ?? []
}
