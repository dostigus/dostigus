import type { OpenedStore } from '@dostigus/db'
import type { Bot, Message, MessageRole } from '@dostigus/shared'
import type { z } from 'zod'
import type { PlatformToolName } from './names'

/** Store handle passed into every in-process tool invoke. */
export type McpToolContext = {
  store: OpenedStore
}

export type McpJsonSchema = Record<string, unknown>

export type McpToolSpec = {
  name: PlatformToolName
  description: string
  inputSchema: z.ZodType
  jsonSchema: McpJsonSchema
}

export type PlatformToolInputs = {
  'bots.list': Record<string, never>
  'bots.get': { id: string }
  'bots.create': { name?: string, modelTier?: string }
  'bots.update': { id: string, name?: string, modelTier?: string }
  'bots.delete': { id: string }
  'messages.list': { botId: string }
  'messages.create': { botId: string, role: MessageRole, content: string }
}

export type PlatformToolResults = {
  'bots.list': { bots: Bot[] }
  'bots.get': { bot: Bot }
  'bots.create': { bot: Bot, greeting: Message }
  'bots.update': { bot: Bot }
  'bots.delete': { ok: true }
  'messages.list': { messages: Message[] }
  'messages.create': { message: Message }
}

/** Runnable MCP surface: registered platform tools + in-process invoke. */
export type PlatformMcpSurface = {
  tools: readonly PlatformToolName[]
  list: () => McpToolSpec[]
  invoke: (name: string, input: unknown, ctx: McpToolContext) => Promise<unknown>
}
