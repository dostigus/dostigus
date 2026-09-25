import type { OpenedStore } from '@dostigus/db'
import type { BotViewer } from '@dostigus/shared'
import type { ZodRawShape } from 'zod'
import type { ArtifactTurn } from './artifacts'
import type { ChatCardTurn } from './chat-cards'
import type { PlatformMcpTool } from './mcp-surface'
import type { OpenAiChatFunctionTool } from './openai-tools'
import type { ScheduleToolContext } from './schedule-tools'
import { StoreError } from '@dostigus/db'
import { BOT_ACCENT_HEXES, BOT_AVATAR_SHAPES, MESSAGE_ROLES, MODEL_TIERS } from '@dostigus/shared'
import { z } from 'zod'
import { artifactActorForTurn, putArtifactFromTool } from './artifacts'
import { noteToolCard } from './chat-cards'
import {
  appendClusterMessage,
  createClusterBot,
  deleteClusterBot,
  deleteClusterSkill,
  getClusterBot,
  listClusterBots,
  listClusterMessages,
  listClusterSkills,
  readClusterSkill,
  updateClusterBot,
  upsertClusterSkill,
  withClusterStore,
} from './cluster-bots'
import { clusterHttpAllowlistGet, clusterHttpAllowlistSet, clusterHttpGet } from './http-allowlist-tools'
import {
  addClusterPantry,
  markClusterCooked,
  readClusterKitchen,
  saveClusterRecipe,
} from './kitchen'
import { mcpJson } from './mcp'
import { CHAT_MCP_TOOLS, chatToolNamesForTurn, isChatMcpTool, isCreatorMemberChatMcpTool, isMemberChatMcpTool, PLATFORM_MCP_TOOLS } from './mcp-surface'
import { mcpToolsToOpenAiFunctions, parseToolCallArguments, toolResultError } from './openai-tools'
import {
  clusterTimezoneGet,
  clusterTimezoneSet,
  schedulesCreate,
  schedulesDelete,
  schedulesList,
  schedulesPause,
  schedulesResume,
  schedulesUpdate,
} from './schedule-tools'
import { writeSelfSettingsNotice } from './self-settings-notice'
import { turnsGet, turnsList } from './turn-tools'

export type PlatformToolSpec = {
  name: PlatformMcpTool
  description: string
  annotations?: { readOnlyHint?: boolean, destructiveHint?: boolean }
  chat: boolean
  inputSchema?: ZodRawShape
  run: (
    input: Record<string, unknown>,
    store: OpenedStore,
    viewer?: BotViewer,
    ctx?: ScheduleToolContext,
  ) => unknown | Promise<unknown>
}

export type ChatToolInvokeResult = {
  ok: boolean
  name: string
  content: string
}

const PLATFORM_TOOL_SPECS: Record<PlatformMcpTool, PlatformToolSpec> = {
  dostigus_bots_list: {
    name: 'dostigus_bots_list',
    description: 'List Bots this caller can open, newest first. The Owner sees every Bot. Each Bot includes id, name, createdAt, createdBy, Manifest (modelTier, avatarShape, avatarColor, label, description, skillIds, modulePackageIds), and lastMessage (latest line on that caller\'s bot-thread, or null).',
    annotations: { readOnlyHint: true },
    chat: true,
    run: (_input, store, viewer) => listClusterBots(store, viewer),
  },
  dostigus_bots_get: {
    name: 'dostigus_bots_get',
    description: 'Get one Bot from the Cluster Store by id, including its Manifest.',
    annotations: { readOnlyHint: true },
    chat: true,
    inputSchema: {
      id: z.string().min(1),
    },
    run: (input, store, viewer) => getClusterBot(store, String(input.id), viewer),
  },
  dostigus_bots_create: {
    name: 'dostigus_bots_create',
    description: 'Create a Bot in the Cluster Store. The Bot is personal to its creator. Optional name (default New Bot), Model tier (default strong), avatarShape, avatarColor (Bot accent palette hex), label, and description. Stores an assistant greeting on the creator\'s bot-thread. Chat asks what the Bot is for.',
    chat: true,
    inputSchema: {
      name: z.string().optional(),
      modelTier: z.enum(MODEL_TIERS).optional(),
      avatarShape: z.enum(BOT_AVATAR_SHAPES).optional(),
      avatarColor: z.enum(BOT_ACCENT_HEXES).optional(),
      label: z.string().optional(),
      description: z.string().optional(),
    },
    run: (input, store, viewer) => createClusterBot(store, {
      name: optionalString(input.name),
      modelTier: optionalString(input.modelTier),
      avatarShape: optionalString(input.avatarShape),
      avatarColor: optionalString(input.avatarColor),
      label: optionalString(input.label),
      description: optionalString(input.description),
    }, viewer),
  },
  dostigus_bots_update: {
    name: 'dostigus_bots_update',
    description: 'Update a Bot Manifest (name, Model tier, avatarShape, avatarColor, label, and/or description). An empty name is rejected. The creator and the Owner may edit. A grantee cannot. Chat self-settings sends name, label, and description.',
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
    run: (input, store, viewer) => updateClusterBot(store, String(input.id), {
      name: optionalString(input.name),
      modelTier: optionalString(input.modelTier),
      avatarShape: optionalString(input.avatarShape),
      avatarColor: optionalString(input.avatarColor),
      label: optionalString(input.label),
      description: optionalString(input.description),
    }, viewer),
  },
  dostigus_bots_delete: {
    name: 'dostigus_bots_delete',
    description: 'Delete a Bot and its Chat messages from the Cluster Store.',
    annotations: { destructiveHint: true },
    chat: false,
    inputSchema: {
      id: z.string().min(1),
    },
    run: (input, store, viewer) => deleteClusterBot(store, String(input.id), viewer),
  },
  dostigus_skills_list: {
    name: 'dostigus_skills_list',
    description: 'List Skills on a Bot as a catalog of id and description only. Anyone who can open that Bot may list them. Full instructions load through dostigus_skills_read.',
    annotations: { readOnlyHint: true },
    chat: true,
    inputSchema: {
      botId: z.string().min(1),
    },
    run: (input, store, viewer) => listClusterSkills(store, String(input.botId), viewer),
  },
  dostigus_skills_read: {
    name: 'dostigus_skills_read',
    description: 'Read one Skill on a Bot by id, including instructions. Anyone who can open that Bot may read it. Use this after dostigus_skills_list when you need the body.',
    annotations: { readOnlyHint: true },
    chat: true,
    inputSchema: {
      botId: z.string().min(1),
      id: z.string().min(1),
    },
    run: (input, store, viewer) => readClusterSkill(store, String(input.botId), input.id, viewer),
  },
  dostigus_skills_upsert: {
    name: 'dostigus_skills_upsert',
    description: 'Create or replace one Skill on a Bot. id is a stable slug (letters, digits, _, -). description (1–200) and instructions are required. The same id replaces the Skill and does not mint a new id. The creator and the Owner may write. A grantee cannot.',
    chat: true,
    inputSchema: {
      botId: z.string().min(1),
      id: z.string().min(1),
      description: z.string().min(1),
      instructions: z.string().min(1),
    },
    run: (input, store, viewer) => upsertClusterSkill(store, String(input.botId), {
      id: input.id,
      description: input.description,
      instructions: input.instructions,
    }, viewer),
  },
  dostigus_skills_delete: {
    name: 'dostigus_skills_delete',
    description: 'Delete one Skill from a Bot by id. The creator and the Owner may delete. A grantee cannot.',
    annotations: { destructiveHint: true },
    chat: true,
    inputSchema: {
      botId: z.string().min(1),
      id: z.string().min(1),
    },
    run: (input, store, viewer) => deleteClusterSkill(store, String(input.botId), input.id, viewer),
  },
  dostigus_messages_list: {
    name: 'dostigus_messages_list',
    description: 'List Chat messages on the caller\'s bot-thread with a Bot, oldest first. Writes the assistant greeting if that bot-thread is empty. Does not copy another person\'s bot-thread.',
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
  dostigus_schedules_list: {
    name: 'dostigus_schedules_list',
    description: 'List Schedules for this person and this Bot, oldest first. Each row has id, optional name, cadence (daily or weekly), timeLocal (HH:MM wall clock in the Cluster timezone), daysOfWeek (sun–sat, weekly only), wakeText, paused, and nextRunAt. Empty name means the Host UI shows truncated wakeText. The Owner may pass personId to list another person. Omit personId to list every Schedule on this Bot when you are the Owner. When the person asked to set a Schedule and you list first, pass intent set plus cadence, timeLocal, and daysOfWeek. If an enabled row already has that clock, the result is already true and you do not create another. A list with no intent does not confirm a Schedule.',
    annotations: { readOnlyHint: true },
    chat: true,
    inputSchema: {
      botId: z.string().min(1),
      personId: z.string().min(1).optional(),
      intent: z.enum(['set']).optional(),
      cadence: z.enum(['daily', 'weekly']).optional(),
      timeLocal: z.string().optional(),
      daysOfWeek: z.array(z.string()).optional(),
    },
    run: (input, store, viewer, ctx) => schedulesList(store, input, viewer, ctx),
  },
  dostigus_schedules_create: {
    name: 'dostigus_schedules_create',
    description: 'Create a Schedule that wakes this Bot on this person\'s bot-thread. Optional name is a short display title (empty stores empty). cadence is daily or weekly. timeLocal is HH:MM 24-hour wall clock in the Cluster timezone. daysOfWeek is required for weekly and omitted for daily (sun, mon, tue, wed, thu, fri, sat). wakeText is the Wake line. The Host sets the next fire. A sentence such as every morning at 08:00 is this call. Do not pass nextRunAt. If an enabled Schedule already has the same cadence, timeLocal, and daysOfWeek, the result is already true, wakeText is unchanged, and no second row is inserted. A paused row with that clock is not already standing; resume it.',
    chat: true,
    inputSchema: {
      botId: z.string().min(1),
      name: z.string().max(80).optional(),
      cadence: z.enum(['daily', 'weekly']),
      timeLocal: z.string().min(4).max(5),
      daysOfWeek: z.array(z.string()).optional(),
      wakeText: z.string().min(1).max(2000),
      personId: z.string().min(1).optional(),
    },
    run: (input, store, viewer, ctx) => schedulesCreate(store, input, viewer, ctx),
  },
  dostigus_schedules_update: {
    name: 'dostigus_schedules_update',
    description: 'Update a Schedule (optional name, cadence, timeLocal, daysOfWeek, and/or wakeText) for this person and this Bot. Empty name clears the title. Recomputes the next fire. The Owner may update any Schedule.',
    chat: true,
    inputSchema: {
      id: z.string().min(1),
      name: z.string().max(80).optional(),
      cadence: z.enum(['daily', 'weekly']).optional(),
      timeLocal: z.string().min(4).max(5).optional(),
      daysOfWeek: z.array(z.string()).optional(),
      wakeText: z.string().min(1).max(2000).optional(),
    },
    run: (input, store, viewer, ctx) => schedulesUpdate(store, input, viewer, ctx),
  },
  dostigus_schedules_pause: {
    name: 'dostigus_schedules_pause',
    description: 'Pause a Schedule. Paused rows do not fire. The row stays.',
    chat: true,
    inputSchema: {
      id: z.string().min(1),
    },
    run: (input, store, viewer, ctx) => schedulesPause(store, input, viewer, ctx),
  },
  dostigus_schedules_resume: {
    name: 'dostigus_schedules_resume',
    description: 'Resume a paused Schedule and recompute the next fire from the wall clock.',
    chat: true,
    inputSchema: {
      id: z.string().min(1),
    },
    run: (input, store, viewer, ctx) => schedulesResume(store, input, viewer, ctx),
  },
  dostigus_schedules_delete: {
    name: 'dostigus_schedules_delete',
    description: 'Delete a Schedule for this person and this Bot. The Owner may delete any Schedule.',
    annotations: { destructiveHint: true },
    chat: true,
    inputSchema: {
      id: z.string().min(1),
    },
    run: (input, store, viewer, ctx) => schedulesDelete(store, input, viewer, ctx),
  },
  dostigus_cluster_timezone_get: {
    name: 'dostigus_cluster_timezone_get',
    description: 'Read the Cluster timezone. stored is the IANA name in Settings when one is set. effective is stored, else DOSTIGUS_TZ, else UTC. source is store, env, or utc.',
    annotations: { readOnlyHint: true },
    chat: true,
    run: (_input, store) => clusterTimezoneGet(store),
  },
  dostigus_cluster_timezone_set: {
    name: 'dostigus_cluster_timezone_set',
    description: 'Set the Cluster timezone to an IANA name such as America/New_York or UTC. Owner only. Wall clocks on Schedules stay; next fire instants move.',
    chat: true,
    inputSchema: {
      timezone: z.string().min(1).max(64),
    },
    run: (input, store, viewer) => clusterTimezoneSet(store, input, viewer),
  },
  dostigus_http_get: {
    name: 'dostigus_http_get',
    description: 'GET one public http or https URL and return status plus a UTF-8 body prefix. Use this when the person needs a live public page or JSON API (a forecast, a feed, a docs page). Build the full URL yourself, including the query string. Do not invent a weather tool, a Weather Skill, or a Module package. GET only: do not pass headers, a body, or a method. The Host follows redirects and re-checks each hop (scheme, Cluster http allowlist, and SSRF). Loopback, private, and link-local destinations are always blocked. A non-empty Cluster http allowlist allows only those hostnames (exact match, no wildcards). The body is capped at 65536 bytes. When the upstream body is longer, the Host returns the prefix and truncated true. Size alone is not an error. If truncated is true, do not claim a complete parse of JSON or HTML. Result fields: status, body, truncated. A non-2xx status still returns status and body when the Host could GET the URL. On a blocked host, a bad scheme, or a host missing from a non-empty allowlist, the tool errors. Report that error. Do not claim a fetch. When status is not ok or the body is unusable, call this tool again with a different public URL you choose for the same kind of public data. Do not invent facts from memory. The Host does not retry other URLs. If this turn has no usable GET, say so honestly.',
    annotations: { readOnlyHint: true },
    chat: true,
    inputSchema: {
      url: z.string().min(1).max(2048),
    },
    run: (input, store, _viewer, ctx) => clusterHttpGet(store, input, ctx),
  },
  dostigus_cluster_http_allowlist_get: {
    name: 'dostigus_cluster_http_allowlist_get',
    description: 'Read the Cluster http allowlist. hosts is the hostname list in Settings. Empty means Host HTTP get may reach any public host (SSRF blocks still apply). Owner Chat only.',
    annotations: { readOnlyHint: true },
    chat: true,
    run: (_input, store) => clusterHttpAllowlistGet(store),
  },
  dostigus_cluster_http_allowlist_set: {
    name: 'dostigus_cluster_http_allowlist_set',
    description: 'Replace the Cluster http allowlist with hosts (hostnames only, exact match, no wildcards, no paths). Empty allows every public host. Owner only. Members do not set it.',
    chat: true,
    inputSchema: {
      hosts: z.array(z.string()),
    },
    run: (input, store, viewer) => clusterHttpAllowlistSet(store, input, viewer),
  },
  dostigus_artifacts_put: {
    name: 'dostigus_artifacts_put',
    description: 'Store an Artifact on the Cluster volume and attach it to this assistant reply. Give filename, mime, and either bytesBase64 (at most 1 MiB) or sourceUrl. sourceUrl uses the same SSRF, Cluster http allowlist, and Bot HTTP egress as dostigus_http_get. The Host sniffs magic bytes and allowlists image/*, application/pdf, text/plain, and text/markdown. There is no get tool and no vision.',
    chat: true,
    inputSchema: {
      filename: z.string().min(1),
      mime: z.string().min(1),
      bytesBase64: z.string().optional(),
      sourceUrl: z.string().optional(),
    },
    run: async (input, store, viewer, ctx) => {
      const artifact = await putArtifactFromTool(store, {
        filename: input.filename,
        mime: input.mime,
        bytesBase64: input.bytesBase64,
        sourceUrl: input.sourceUrl,
        actorPersonId: artifactActorForTurn(store, {
          personId: viewer?.id ?? ctx?.personId,
          wake: ctx?.wake === true,
        }),
        fetchImpl: ctx?.fetchImpl,
        lookup: ctx?.lookup,
        env: ctx?.env,
      })
      ctx?.artifacts?.note(artifact.id)
      return { artifact }
    },
  },
  dostigus_turns_list: {
    name: 'dostigus_turns_list',
    description: 'List Host Bot turns in this Cluster, newest first. Optional filters: botId, threadId, since (ISO-8601 or epoch milliseconds), and limit (default 50, cap 100). Each turn has id, threadId, botId, personId, trigger (user, wake, or mention), outcome (running, ok, error, or abort), startedAt, endedAt, scheduleId, errorCode, phases (thinking, tool, or typing, with at), tools (name, ok, ms), modelId, modelTier, and visionParts. modelId, modelTier, and visionParts may be null. No message bodies, tool arguments, or tool results. The ops token sees every turn. This tool is not a Chat tool.',
    annotations: { readOnlyHint: true },
    chat: false,
    inputSchema: {
      botId: z.string().optional(),
      threadId: z.string().optional(),
      since: z.string().optional(),
      limit: z.union([z.number().int(), z.string().regex(/^\d+$/)]).optional(),
    },
    run: (input, store) => turnsList(store, input),
  },
  dostigus_turns_get: {
    name: 'dostigus_turns_get',
    description: 'Get one Host Bot turn by id. Same fields as dostigus_turns_list. No message body, tool arguments, or tool results. The ops token sees every turn. This tool is not a Chat tool.',
    annotations: { readOnlyHint: true },
    chat: false,
    inputSchema: {
      id: z.string().min(1),
    },
    run: (input, store) => turnsGet(store, input),
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
  options?: { canEditManifest?: boolean, expand?: boolean, wake?: boolean },
): OpenAiChatFunctionTool[] {
  const names = chatToolNamesForTurn({
    role,
    canEditManifest: options?.canEditManifest === true,
    expand: options?.expand === true,
    wake: options?.wake === true,
  })
  return mcpToolsToOpenAiFunctions(names.map((name) => PLATFORM_TOOL_SPECS[name]))
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
        mcpJson(await Promise.resolve(withClusterStore((store) => spec.run(input, store))))
      : async () => mcpJson(await Promise.resolve(withClusterStore((store) => spec.run({}, store)))),
  }
}

export function invokeChatMcpTool(input: {
  name: string
  args: unknown
  store: OpenedStore
  role?: 'owner' | 'member'
  personId?: string
  /** Schedule tools stay on the Bot for this Chat turn. */
  turnBotId?: string
  /** Host-injected Chat Cards for this turn. */
  cards?: ChatCardTurn
  artifacts?: ArtifactTurn
  wake?: boolean
  /** This turn's Chat allowlist. Omit to use the role union (handler tests). */
  allowedTools?: readonly string[]
  fetchImpl?: typeof fetch
  lookup?: ScheduleToolContext['lookup']
  env?: NodeJS.ProcessEnv
}): ChatToolInvokeResult | Promise<ChatToolInvokeResult> {
  const name = input.name
  if (input.allowedTools && !input.allowedTools.includes(name)) {
    logChatTool(name, 'skip')
    return {
      ok: false,
      name,
      content: toolResultError('unknown or unavailable tool'),
    }
  }
  if (input.role === 'member') {
    if (!isMemberChatMcpTool(name) && !isCreatorMemberChatMcpTool(name)) {
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
    const ctx: ScheduleToolContext = {
      turnBotId: input.turnBotId,
      fetchImpl: input.fetchImpl,
      lookup: input.lookup,
      env: input.env,
      personId: input.personId,
      wake: input.wake,
      artifacts: input.artifacts,
    }
    const result = spec.run(parsed, input.store, viewer, ctx)
    if (isPromise(result)) {
      return result.then(
        (resolved) => finishChatTool(input, spec.name, parsed, resolved),
        (error: unknown) => failChatTool(spec.name, error),
      )
    }
    return finishChatTool(input, spec.name, parsed, result)
  } catch (error) {
    return failChatTool(spec.name, error)
  }
}

function finishChatTool(
  input: {
    store: OpenedStore
    personId?: string
    role?: 'owner' | 'member'
    turnBotId?: string
    cards?: ChatCardTurn
  },
  name: string,
  args: Record<string, unknown>,
  result: unknown,
): ChatToolInvokeResult {
  if (input.cards) {
    noteToolCard(input.cards, name, result)
  }
  writeSelfSettingsNotice({
    store: input.store,
    personId: input.personId,
    role: input.role,
    turnBotId: input.turnBotId,
    name,
    result,
    args,
  })
  logChatTool(name, 'ok')
  return { ok: true, name, content: mcpJson(result) }
}

function failChatTool(name: string, error: unknown): ChatToolInvokeResult {
  logChatTool(name, 'fail')
  return {
    ok: false,
    name,
    content: toolResultError(toolErrorMessage(error)),
  }
}

function isPromise(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value
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
