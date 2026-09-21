import type { McpToolContext, McpToolSpec } from './types'
import {
  createBot,
  deleteBot,
  ensureGreeting,
  insertMessage,
  listBots,
  listMessages,
  requireBot,
  updateBot,
} from '@dostigus/db'
import { MESSAGE_ROLES } from '@dostigus/shared'
import { z } from 'zod'

type PlatformTool = Omit<McpToolSpec, 'jsonSchema'> & {
  handler: (input: unknown, ctx: McpToolContext) => unknown | Promise<unknown>
}

const emptyInput = z.object({})

const botIdInput = z.object({
  id: z.string(),
})

const botWriteInput = z.object({
  name: z.string().optional(),
  modelTier: z.string().optional(),
})

const botUpdateInput = z.object({
  id: z.string(),
  name: z.string().optional(),
  modelTier: z.string().optional(),
})

const messagesListInput = z.object({
  botId: z.string(),
})

const messagesCreateInput = z.object({
  botId: z.string(),
  role: z.enum(MESSAGE_ROLES),
  content: z.string(),
})

export const platformTools: PlatformTool[] = [
  {
    name: 'bots.list',
    description: 'List Bots in the Cluster Store, newest first.',
    inputSchema: emptyInput,
    handler: (_input, ctx) => ({ bots: listBots(ctx.store) }),
  },
  {
    name: 'bots.get',
    description: 'Get one Bot by id from the Cluster Store.',
    inputSchema: botIdInput,
    handler: (input, ctx) => {
      const { id } = botIdInput.parse(input)
      return { bot: requireBot(ctx.store, id) }
    },
  },
  {
    name: 'bots.create',
    description: 'Create a Bot in the Cluster Store. Writes the first Chat greeting.',
    inputSchema: botWriteInput,
    handler: (input, ctx) => {
      const body = botWriteInput.parse(input)
      return createBot(ctx.store, body)
    },
  },
  {
    name: 'bots.update',
    description: 'Update a Bot name and/or Manifest Model tier.',
    inputSchema: botUpdateInput,
    handler: (input, ctx) => {
      const { id, name, modelTier } = botUpdateInput.parse(input)
      return { bot: updateBot(ctx.store, id, { name, modelTier }) }
    },
  },
  {
    name: 'bots.delete',
    description: 'Delete a Bot and its Chat messages from the Cluster Store.',
    inputSchema: botIdInput,
    handler: (input, ctx) => {
      const { id } = botIdInput.parse(input)
      deleteBot(ctx.store, id)
      return { ok: true as const }
    },
  },
  {
    name: 'messages.list',
    description: 'List Chat messages for a Bot. Ensures the greeting exists.',
    inputSchema: messagesListInput,
    handler: (input, ctx) => {
      const { botId } = messagesListInput.parse(input)
      ensureGreeting(ctx.store, botId)
      return { messages: listMessages(ctx.store, botId) }
    },
  },
  {
    name: 'messages.create',
    description: 'Append a Chat message (user, assistant, or system) for a Bot.',
    inputSchema: messagesCreateInput,
    handler: (input, ctx) => {
      const { botId, role, content } = messagesCreateInput.parse(input)
      return {
        message: insertMessage(ctx.store, { botId, role, content }),
      }
    },
  },
]
