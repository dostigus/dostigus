import type { OpenedStore } from '@dostigus/db'
import type { BotViewer } from '@dostigus/shared'
import type { ZodRawShape } from 'zod'
import type { PlatformMcpTool } from './mcp-surface'
import type { OpenAiChatFunctionTool } from './openai-tools'
import { StoreError } from '@dostigus/db'
import { BOT_ACCENT_HEXES, BOT_AVATAR_SHAPES, MESSAGE_ROLES, MODEL_TIERS } from '@dostigus/shared'
import { z } from 'zod'
import {
  appendClusterMessage,
  createClusterBot,
  deleteClusterBot,
  getClusterBot,
  listClusterBots,
  listClusterMessages,
  updateClusterBot,
  withClusterStore,
} from './cluster-bots'
import {
  addClusterPantry,
  markClusterCooked,
  readClusterKitchen,
  saveClusterRecipe,
} from './kitchen'
import { mcpJson } from './mcp'
import { CHAT_MCP_TOOLS, isChatMcpTool, isMemberChatMcpTool, MEMBER_CHAT_MCP_TOOLS, PLATFORM_MCP_TOOLS } from './mcp-surface'
import { mcpToolsToOpenAiFunctions, parseToolCallArguments, toolResultError } from './openai-tools'

export type PlatformToolSpec = {
  name: PlatformMcpTool
  description: string
  annotations?: { readOnlyHint?: boolean, destructiveHint?: boolean }
  chat: boolean
  inputSchema?: ZodRawShape
  run: (input: Record<string, unknown>, store: OpenedStore, viewer?: BotViewer) => unknown
}

export type ChatToolInvokeResult = {
  ok: boolean
  name: string
  content: string
}

const PLATFORM_TOOL_SPECS: Record<PlatformMcpTool, PlatformToolSpec> = {
  dostigus_bots_list: {
    name: 'dostigus_bots_list',
    description: 'List Bots in the Cluster Store, newest first. Each Bot includes id, name, createdAt, Manifest (modelTier, avatarShape, avatarColor, label, description, skillIds, modulePackageIds), and lastMessage (latest Chat line preview, or null).',
    annotations: { readOnlyHint: true },
    chat: true,
    run: (_input, store) => listClusterBots(store),
  },
  dostigus_bots_get: {
    name: 'dostigus_bots_get',
    description: 'Get one Bot from the Cluster Store by id, including its Manifest.',
    annotations: { readOnlyHint: true },
    chat: true,
    inputSchema: {
      id: z.string().min(1),
    },
    run: (input, store) => getClusterBot(store, String(input.id)),
  },
  dostigus_bots_create: {
    name: 'dostigus_bots_create',
    description: 'Create a Bot in the Cluster Store. Optional name (default New Bot), Model tier (default strong), avatarShape, avatarColor (Bot accent palette hex), label, and description. Stores an assistant greeting. Chat asks what the Bot is for.',
    chat: true,
    inputSchema: {
      name: z.string().optional(),
      modelTier: z.enum(MODEL_TIERS).optional(),
      avatarShape: z.enum(BOT_AVATAR_SHAPES).optional(),
      avatarColor: z.enum(BOT_ACCENT_HEXES).optional(),
      label: z.string().optional(),
      description: z.string().optional(),
    },
    run: (input, store) => createClusterBot(store, {
      name: optionalString(input.name),
      modelTier: optionalString(input.modelTier),
      avatarShape: optionalString(input.avatarShape),
      avatarColor: optionalString(input.avatarColor),
      label: optionalString(input.label),
      description: optionalString(input.description),
    }),
  },
  dostigus_bots_update: {
    name: 'dostigus_bots_update',
    description: 'Update a Bot name, Model tier, avatarShape, avatarColor, label, and/or description in the Cluster Store.',
    chat: true,
    inputSchema: {
      id: z.string().min(1),
      name: z.string().optional(),
      modelTier: z.enum(MODEL_TIERS).optional(),
      avatarShape: z.enum(BOT_AVATAR_SHAPES).optional(),
      avatarColor: z.enum(BOT_ACCENT_HEXES).optional(),
      label: z.string().optional(),
      description: z.string().optional(),
    },
    run: (input, store) => updateClusterBot(store, String(input.id), {
      name: optionalString(input.name),
      modelTier: optionalString(input.modelTier),
      avatarShape: optionalString(input.avatarShape),
      avatarColor: optionalString(input.avatarColor),
      label: optionalString(input.label),
      description: optionalString(input.description),
    }),
  },
  dostigus_bots_delete: {
    name: 'dostigus_bots_delete',
    description: 'Delete a Bot and its Chat messages from the Cluster Store.',
    annotations: { destructiveHint: true },
    chat: false,
    inputSchema: {
      id: z.string().min(1),
    },
    run: (input, store) => deleteClusterBot(store, String(input.id)),
  },
  dostigus_messages_list: {
    name: 'dostigus_messages_list',
    description: 'List Chat messages on the caller\'s bot-thread with a Bot, oldest first. Writes the assistant greeting if that bot-thread is empty. A shared Bot is not one Household-wide timeline.',
    chat: true,
    inputSchema: {
      botId: z.string().min(1),
    },
    run: (input, store, viewer) => listClusterMessages(store, String(input.botId), viewer),
  },
  dostigus_messages_create: {
    name: 'dostigus_messages_create',
    description: 'Append a Chat message on the caller\'s bot-thread with a Bot. Role is user, assistant, or system (default user). Does not call the LLM gateway.',
    chat: true,
    inputSchema: {
      botId: z.string().min(1),
      content: z.string().min(1),
      role: z.enum(MESSAGE_ROLES).optional(),
    },
    run: (input, store, viewer) => ({
      message: appendClusterMessage(store, {
        botId: String(input.botId),
        role: (optionalString(input.role) as 'user' | 'assistant' | 'system' | undefined) ?? 'user',
        content: String(input.content),
        personId: optionalString(input.personId) ?? null,
        viewer,
      }),
    }),
  },
  dostigus_kitchen_pantry_list: {
    name: 'dostigus_kitchen_pantry_list',
    description: 'List Kitchen pantry items in the Cluster Store, oldest first. Each item has id, name, optional qty, and createdAt.',
    annotations: { readOnlyHint: true },
    chat: false,
    run: (_input, store) => {
      const { kitchen } = readClusterKitchen(store)
      return { pantry: kitchen.pantry }
    },
  },
  dostigus_kitchen_pantry_add: {
    name: 'dostigus_kitchen_pantry_add',
    description: 'Add a Kitchen pantry item. name is required. qty is optional text.',
    chat: false,
    inputSchema: {
      name: z.string(),
      qty: z.union([z.string(), z.number()]).optional(),
    },
    run: (input, store) => addClusterPantry(store, {
      name: input.name,
      qty: input.qty,
    }),
  },
  dostigus_kitchen_cooked_mark: {
    name: 'dostigus_kitchen_cooked_mark',
    description: 'Mark something cooked in the Kitchen. Adds a cooked log row and 10 XP. label is optional (default Cooked). personId is optional.',
    chat: false,
    inputSchema: {
      label: z.string().optional(),
      personId: z.string().optional(),
    },
    run: (input, store) => markClusterCooked(store, {
      label: input.label,
      personId: optionalString(input.personId) ?? null,
    }),
  },
  dostigus_kitchen_recipe_get: {
    name: 'dostigus_kitchen_recipe_get',
    description: 'Get the one Kitchen recipe (name and ingredients) and the XP counter. recipe is null until one is saved.',
    annotations: { readOnlyHint: true },
    chat: false,
    run: (_input, store) => {
      const { kitchen } = readClusterKitchen(store)
      return { recipe: kitchen.recipe, xp: kitchen.xp }
    },
  },
  dostigus_kitchen_recipe_save: {
    name: 'dostigus_kitchen_recipe_save',
    description: 'Save the one Kitchen recipe. Replaces the previous name and ingredients text.',
    chat: false,
    inputSchema: {
      name: z.string(),
      ingredients: z.string().optional(),
    },
    run: (input, store) => saveClusterRecipe(store, {
      name: input.name,
      ingredients: input.ingredients,
    }),
  },
}

export function platformToolSpec(name: PlatformMcpTool): PlatformToolSpec {
  return PLATFORM_TOOL_SPECS[name]
}

export function listPlatformToolSpecs(): PlatformToolSpec[] {
  return PLATFORM_MCP_TOOLS.map((name) => PLATFORM_TOOL_SPECS[name])
}

export function listChatMcpToolSpecs(): PlatformToolSpec[] {
  return CHAT_MCP_TOOLS.map((name) => PLATFORM_TOOL_SPECS[name])
}

export function chatMcpToolsAsOpenAi(
  role: 'owner' | 'member' = 'owner',
): OpenAiChatFunctionTool[] {
  const specs = role === 'member'
    ? MEMBER_CHAT_MCP_TOOLS.map((name) => PLATFORM_TOOL_SPECS[name])
    : listChatMcpToolSpecs()
  return mcpToolsToOpenAiFunctions(specs)
}

/** Options passed to `defineMcpTool` — same handlers the Chat loop invokes. */
export function registeredMcpToolOptions(name: PlatformMcpTool) {
  const spec = PLATFORM_TOOL_SPECS[name]
  return {
    name: spec.name,
    description: spec.description,
    ...(spec.annotations ? { annotations: spec.annotations } : {}),
    ...(spec.inputSchema ? { inputSchema: spec.inputSchema } : {}),
    handler: spec.inputSchema
      ? async (input: Record<string, unknown>) =>
        mcpJson(withClusterStore((store) => spec.run(input, store)))
      : async () => mcpJson(withClusterStore((store) => spec.run({}, store))),
  }
}

export function invokeChatMcpTool(input: {
  name: string
  args: unknown
  store: OpenedStore
  role?: 'owner' | 'member'
  personId?: string
}): ChatToolInvokeResult {
  const name = input.name
  if (input.role === 'member') {
    if (!isMemberChatMcpTool(name)) {
      logChatTool(name, 'skip')
      return {
        ok: false,
        name,
        content: toolResultError('unknown or unavailable tool'),
      }
    }
  } else if (!isChatMcpTool(name)) {
    logChatTool(name, 'skip')
    return {
      ok: false,
      name,
      content: toolResultError('unknown or unavailable tool'),
    }
  }

  const spec = PLATFORM_TOOL_SPECS[name]
  try {
    const parsed = parseChatToolInput(spec, parseToolCallArguments(input.args))
    if (input.name === 'dostigus_messages_create' && input.personId) {
      const role = optionalString(parsed.role) ?? 'user'
      if (role === 'user') {
        parsed.personId = input.personId
      }
    }
    const viewer = input.personId
      ? {
          id: input.personId,
          role: input.role === 'member' ? 'member' as const : 'owner' as const,
        }
      : undefined
    const result = spec.run(parsed, input.store, viewer)
    logChatTool(spec.name, 'ok')
    return { ok: true, name: spec.name, content: mcpJson(result) }
  } catch (error) {
    logChatTool(spec.name, 'fail')
    return {
      ok: false,
      name: spec.name,
      content: toolResultError(toolErrorMessage(error)),
    }
  }
}

export function parseChatToolInput(
  spec: Pick<PlatformToolSpec, 'inputSchema'>,
  args: unknown,
): Record<string, unknown> {
  const schema = z.object(spec.inputSchema ?? {})
  return schema.parse(args ?? {}) as Record<string, unknown>
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function toolErrorMessage(error: unknown): string {
  if (error instanceof StoreError) {
    return error.message
  }
  if (error instanceof z.ZodError) {
    return 'invalid tool arguments'
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return 'tool failed'
}

function logChatTool(name: string, outcome: 'ok' | 'fail' | 'skip'): void {
  console.warn(`Chat MCP tool ${name} ${outcome}`)
}
