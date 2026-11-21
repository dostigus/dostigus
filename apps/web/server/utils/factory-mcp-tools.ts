import type { FactoryCaller, OpenedStore } from '@dostigus/db'
import type { ZodRawShape } from 'zod'
import type { ContextConfig } from './context-client'
import type { PlatformToolSpec } from './mcp-platform-tools'
import type { FACTORY_MCP_TOOLS } from './mcp-surface'
import { createHash } from 'node:crypto'
import {
  artifactOnProject,
  attachTaskArtifact,
  bindContextProject,
  createProject,
  createTask,
  createTicket,
  getTask,
  linkRepo,
  listProjects,
  listTasks,
  listTickets,
  projectForCaller,
  setCommands,
  StoreError,
  transitionTask,
  updateProject,
  updateTask,
  updateTicket,
} from '@dostigus/db'
import { z } from 'zod'
import { putArtifactFromTool } from './artifacts'
import {
  callContextTool,
  CONTEXT_NOT_CONFIGURED,
  CONTEXT_PACK_BUDGET_MAX,
  CONTEXT_PACK_BUDGET_MIN,
  CONTEXT_SCOPE,
  ContextClientError,

  contextConfigFromRuntime,
} from './context-client'
import { activeFactoryCaller } from './mcp-auth'

type FactoryToolName = typeof FACTORY_MCP_TOOLS[number]

export type ContextDeps = {
  config?: ContextConfig | null
  fetchImpl?: typeof fetch
  caller?: FactoryCaller
}

const projectId = z.string().min(1)
const taskId = z.string().min(1)

function requireCaller(explicit?: FactoryCaller): FactoryCaller {
  if (explicit) {
    return explicit
  }
  return activeFactoryCaller()
}

function resolveContext(deps?: ContextDeps): ContextConfig | null {
  if (deps && 'config' in deps) {
    return deps.config ?? null
  }
  return contextConfigFromRuntime()
}

function missingContext(deps?: ContextDeps): { error: string } | undefined {
  if (!resolveContext(deps)) {
    return { error: CONTEXT_NOT_CONFIGURED }
  }
  return undefined
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

async function contextCall(
  name: string,
  args: Record<string, unknown>,
  deps?: ContextDeps,
): Promise<unknown> {
  const config = resolveContext(deps)
  if (!config) {
    return { error: CONTEXT_NOT_CONFIGURED }
  }
  try {
    return await callContextTool(config, name, args, deps?.fetchImpl)
  } catch (error) {
    if (error instanceof ContextClientError || error instanceof StoreError) {
      return { error: error.message }
    }
    throw error
  }
}

function budget(mode: string | undefined, value: unknown): number | undefined {
  if (value === undefined) {
    return undefined
  }
  const parsed = z.number().int().safeParse(value)
  if (!parsed.success) {
    throw new StoreError('budgetBytes must be an integer', 400)
  }
  const min = mode === 'pack' ? CONTEXT_PACK_BUDGET_MIN : 2048
  if (parsed.data < min || parsed.data > CONTEXT_PACK_BUDGET_MAX) {
    throw new StoreError(`budgetBytes must be from ${min} to ${CONTEXT_PACK_BUDGET_MAX}`, 400)
  }
  return parsed.data
}

export async function proxyContextSearch(
  store: OpenedStore,
  input: Record<string, unknown>,
  deps?: ContextDeps,
): Promise<unknown> {
  const missing = missingContext(deps)
  if (missing) {
    return missing
  }
  const project = projectForCaller(store, requireCaller(deps?.caller), text(input.projectId))
  if (!project.contextProjectId) {
    return { error: 'Context project is not created yet' }
  }
  const query = text(input.query)
  if (!query?.trim()) {
    throw new StoreError('query is required', 400)
  }
  const mode = text(input.mode)
  const bytes = budget(mode, input.budgetBytes)
  return contextCall('search', {
    scope: CONTEXT_SCOPE,
    query,
    project: project.contextProjectId,
    ...(mode === 'pack' ? { mode: 'pack' } : {}),
    ...(bytes === undefined ? {} : { budgetBytes: bytes }),
  }, deps)
}

export async function proxyContextRemember(
  store: OpenedStore,
  input: Record<string, unknown>,
  deps?: ContextDeps,
): Promise<unknown> {
  const missing = missingContext(deps)
  if (missing) {
    return missing
  }
  const project = projectForCaller(store, requireCaller(deps?.caller), text(input.projectId))
  const body = text(input.text)?.trim() ?? ''
  if (!body) {
    throw new StoreError('text is required', 400)
  }
  const creating = !project.contextProjectId
  const contextId = project.contextProjectId ?? project.slug
  const result = await contextCall('remember', {
    version: 1,
    scope: CONTEXT_SCOPE,
    text: body,
    idempotencyKey: idempotencyKey(contextId, body, text(input.idempotencyKey)),
    project: [contextId],
    ...(creating ? { projectName: project.name } : {}),
  }, deps)
  if (creating && !contextFailed(result)) {
    bindContextProject(store, project.id, contextId)
  }
  return result
}

export async function proxyContextRead(
  store: OpenedStore,
  input: Record<string, unknown>,
  deps?: ContextDeps,
): Promise<unknown> {
  const missing = missingContext(deps)
  if (missing) {
    return missing
  }
  const project = projectForCaller(store, requireCaller(deps?.caller), text(input.projectId))
  if (!project.contextProjectId) {
    return { error: 'Context project is not created yet' }
  }
  const id = text(input.id)?.trim() ?? ''
  if (!id) {
    throw new StoreError('id is required', 400)
  }
  assertContextReadId(project.contextProjectId, id)
  const result = await contextCall('read', {
    version: 1,
    scope: CONTEXT_SCOPE,
    id,
  }, deps)
  if (contextFailed(result)) {
    return result
  }
  assertReadBelongs(project.contextProjectId, result)
  return result
}

export async function proxyContextTimeline(
  store: OpenedStore,
  input: Record<string, unknown>,
  deps?: ContextDeps,
): Promise<unknown> {
  const missing = missingContext(deps)
  if (missing) {
    return missing
  }
  const project = projectForCaller(store, requireCaller(deps?.caller), text(input.projectId))
  if (!project.contextProjectId) {
    return { error: 'Context project is not created yet' }
  }
  const limit = input.limit === undefined ? undefined : z.number().int().min(1).max(20).parse(input.limit)
  return contextCall('timeline', {
    scope: CONTEXT_SCOPE,
    project: project.contextProjectId,
    ...(text(input.since) ? { since: text(input.since) } : {}),
    ...(text(input.until) ? { until: text(input.until) } : {}),
    ...(limit === undefined ? {} : { limit }),
  }, deps)
}

function assertContextReadId(contextProjectId: string, id: string): void {
  if (id.startsWith('profile:') && id !== `profile:${contextProjectId}`) {
    throw new StoreError('This token is scoped to another Project', 403)
  }
  if (id.startsWith('doc:')) {
    const named = id.split(':')[1]
    if (named !== contextProjectId) {
      throw new StoreError('This token is scoped to another Project', 403)
    }
  }
}

function assertReadBelongs(contextProjectId: string, result: unknown): void {
  if (!result || typeof result !== 'object') {
    throw new StoreError('This token is scoped to another Project', 403)
  }
  const record = result as {
    profile?: { projectId?: string }
    associations?: Array<{ projectId?: string }>
  }
  if (record.profile?.projectId === contextProjectId) {
    return
  }
  if (record.associations?.some((entry) => entry.projectId === contextProjectId)) {
    return
  }
  throw new StoreError('This token is scoped to another Project', 403)
}

function contextFailed(result: unknown): boolean {
  return !!result && typeof result === 'object' && typeof (result as { error?: unknown }).error === 'string'
}

function idempotencyKey(contextId: string, body: string, given: string | undefined): string {
  if (given && /^[\w.:-]{1,128}$/.test(given)) {
    return given
  }
  return createHash('sha256').update(`${contextId}\n${body}`).digest('hex')
}

async function attach(store: OpenedStore, input: Record<string, unknown>, who: FactoryCaller) {
  const task = getTask(store, who, String(input.taskId))
  const artifactId = text(input.artifactId)
  if (artifactId) {
    if (who.kind === 'project' && !artifactOnProject(store, artifactId, task.projectId)) {
      throw new StoreError('This token is scoped to another Project', 403)
    }
    return { task: attachTaskArtifact(store, who, task.id, artifactId) }
  }
  if (!text(input.bytesBase64)) {
    throw new StoreError('Give artifactId or bytesBase64', 400)
  }
  const project = projectForCaller(store, who, task.projectId)
  const artifact = await putArtifactFromTool(store, {
    filename: input.filename,
    mime: input.mime,
    bytesBase64: input.bytesBase64,
    actorPersonId: project.ownerId,
  })
  return { task: attachTaskArtifact(store, who, task.id, artifact.id), artifact }
}

function tool(
  name: FactoryToolName,
  description: string,
  inputSchema: ZodRawShape,
  run: (input: Record<string, unknown>, store: OpenedStore, who: FactoryCaller) => unknown,
  readOnly = false,
): PlatformToolSpec {
  return {
    name,
    description,
    chat: false,
    ...(readOnly ? { annotations: { readOnlyHint: true } } : {}),
    inputSchema,
    run: (input, store, _viewer, ctx) => {
      const explicit = (ctx as { factoryCaller?: FactoryCaller } | undefined)?.factoryCaller
      return run(input, store, requireCaller(explicit))
    },
  }
}

export const FACTORY_TOOL_SPECS: Record<FactoryToolName, PlatformToolSpec> = {
  dostigus_projects_list: tool(
    'dostigus_projects_list',
    'List Projects this caller can see. The owner token sees every Project. A Project token sees only its Project. Each row includes the Repo link, Commands, the Architect Bot id, and contextProjectId when Context has been created.',
    {},
    (_input, store, who) => ({ projects: listProjects(store, who) }),
    true,
  ),
  dostigus_projects_get: tool(
    'dostigus_projects_get',
    'Get one Project by projectId, including its Repo link and Commands. A Project token may only get its own Project.',
    { projectId },
    (input, store, who) => ({ project: projectForCaller(store, who, String(input.projectId)) }),
    true,
  ),
  dostigus_projects_create: tool(
    'dostigus_projects_create',
    'Create a Project and its Architect Bot. Owner token only. A Project token cannot create a Project. Optional slug (lowercase letters, digits, hyphens) becomes the Context project id on the first remember. Optional previewUrl.',
    {
      name: z.string().min(1),
      slug: z.string().min(1).optional(),
      previewUrl: z.string().optional(),
    },
    (input, store, who) => ({
      project: createProject(store, who, {
        name: String(input.name),
        slug: text(input.slug),
        previewUrl: text(input.previewUrl),
      }),
    }),
  ),
  dostigus_projects_update: tool(
    'dostigus_projects_update',
    'Update a Project name, previewUrl, status (active or archived), or architectMode (external or builtin). Does not change the slug or contextProjectId.',
    {
      projectId,
      name: z.string().min(1).optional(),
      previewUrl: z.string().nullable().optional(),
      status: z.enum(['active', 'archived']).optional(),
      architectMode: z.enum(['external', 'builtin']).optional(),
    },
    (input, store, who) => ({
      project: updateProject(store, who, String(input.projectId), {
        name: text(input.name),
        previewUrl: input.previewUrl === undefined ? undefined : (input.previewUrl as string | null),
        status: text(input.status),
        architectMode: text(input.architectMode),
      }),
    }),
  ),
  dostigus_repos_link: tool(
    'dostigus_repos_link',
    'Link the GitHub repo for a Project (one Repo link). fullName is owner/repo. defaultBranch defaults to main. docsLayout paths are relative paths for ADRs, Specs, and the glossary.',
    {
      projectId,
      fullName: z.string().min(1),
      defaultBranch: z.string().min(1).optional(),
      docsLayout: z.object({
        adrs: z.string().min(1).optional(),
        specs: z.string().min(1).optional(),
        glossary: z.string().min(1).optional(),
      }).optional(),
    },
    (input, store, who) => ({
      project: linkRepo(store, who, String(input.projectId), {
        fullName: String(input.fullName),
        defaultBranch: text(input.defaultBranch),
        docsLayout: input.docsLayout as { adrs?: string, specs?: string, glossary?: string } | undefined,
      }),
    }),
  ),
  dostigus_commands_set: tool(
    'dostigus_commands_set',
    'Set Commands on the Project Repo link. Keys are setup, lint, test, check, run, and preview. An empty string clears a command. Link a repo first.',
    {
      projectId,
      setup: z.string().nullable().optional(),
      lint: z.string().nullable().optional(),
      test: z.string().nullable().optional(),
      check: z.string().nullable().optional(),
      run: z.string().nullable().optional(),
      preview: z.string().nullable().optional(),
    },
    (input, store, who) => ({
      project: setCommands(store, who, String(input.projectId), {
        setup: input.setup as string | null | undefined,
        lint: input.lint as string | null | undefined,
        test: input.test as string | null | undefined,
        check: input.check as string | null | undefined,
        run: input.run as string | null | undefined,
        preview: input.preview as string | null | undefined,
      }),
    }),
  ),
  dostigus_tasks_list: tool(
    'dostigus_tasks_list',
    'List Tasks on a Project, newest first. Each Task includes mode, status, grillPolicy, and attachments (Artifact meta, no bytes).',
    { projectId },
    (input, store, who) => ({ tasks: listTasks(store, who, String(input.projectId)) }),
    true,
  ),
  dostigus_tasks_get: tool(
    'dostigus_tasks_get',
    'Get one Task by taskId, including attachments. A Project token can only read Tasks on its Project.',
    { taskId },
    (input, store, who) => ({ task: getTask(store, who, String(input.taskId)) }),
    true,
  ),
  dostigus_tasks_create: tool(
    'dostigus_tasks_create',
    'Create a Task on a Project. mode is quick, bug, feature, or epic. Status starts at new. feature and epic require a Grill. bug is a short Grill. quick can skip later with a written reason.',
    {
      projectId,
      title: z.string().min(1),
      body: z.string().optional(),
      mode: z.enum(['quick', 'bug', 'feature', 'epic']),
    },
    (input, store, who) => ({
      task: createTask(store, who, String(input.projectId), {
        title: String(input.title),
        body: text(input.body),
        mode: String(input.mode),
      }),
    }),
  ),
  dostigus_tasks_update: tool(
    'dostigus_tasks_update',
    'Update a Task title, body, mode, or grillPolicy. grillPolicy skipped is only for mode quick and needs grillSkipReason. This does not move the board status. Use dostigus_tasks_transition for that.',
    {
      taskId,
      title: z.string().min(1).optional(),
      body: z.string().optional(),
      mode: z.enum(['quick', 'bug', 'feature', 'epic']).optional(),
      grillPolicy: z.enum(['required', 'short', 'skipped']).optional(),
      grillSkipReason: z.string().nullable().optional(),
    },
    (input, store, who) => ({
      task: updateTask(store, who, String(input.taskId), {
        title: text(input.title),
        body: text(input.body),
        mode: text(input.mode),
        grillPolicy: text(input.grillPolicy),
        grillSkipReason: input.grillSkipReason as string | null | undefined,
      }),
    }),
  ),
  dostigus_tasks_transition: tool(
    'dostigus_tasks_transition',
    'Move a Task on the board. status is new, grilling, awaiting_approval, in_work, awaiting_acceptance, released, or dropped.',
    {
      taskId,
      status: z.enum([
        'new',
        'grilling',
        'awaiting_approval',
        'in_work',
        'awaiting_acceptance',
        'released',
        'dropped',
      ]),
    },
    (input, store, who) => ({
      task: transitionTask(store, who, String(input.taskId), String(input.status)),
    }),
  ),
  dostigus_tasks_attach: tool(
    'dostigus_tasks_attach',
    'Attach an Artifact to a Task. Pass artifactId for an Artifact already in the Store, or filename, mime, and bytesBase64 (at most 1 MiB) to store one and attach it. There is no get tool.',
    {
      taskId,
      artifactId: z.string().min(1).optional(),
      filename: z.string().min(1).optional(),
      mime: z.string().min(1).optional(),
      bytesBase64: z.string().min(1).optional(),
    },
    (input, store, who) => attach(store, input, who),
  ),
  dostigus_tickets_list: tool(
    'dostigus_tickets_list',
    'List Tickets on a Task, oldest first. The business board does not show Tickets. blockedBy names other Ticket ids on the same Task.',
    { taskId },
    (input, store, who) => ({ tickets: listTickets(store, who, String(input.taskId)) }),
    true,
  ),
  dostigus_tickets_create: tool(
    'dostigus_tickets_create',
    'Cut a Ticket on a Task. brief is what to build and the acceptance criteria. blockedBy lists Ticket ids that must finish first (create blockers first). status defaults to ready. Optional builderHint.',
    {
      taskId,
      title: z.string().min(1),
      brief: z.string().optional(),
      blockedBy: z.array(z.string()).optional(),
      builderHint: z.string().nullable().optional(),
      status: z.enum(['ready', 'in_work', 'done', 'dropped']).optional(),
    },
    (input, store, who) => ({
      ticket: createTicket(store, who, String(input.taskId), {
        title: String(input.title),
        brief: text(input.brief),
        blockedBy: Array.isArray(input.blockedBy) ? input.blockedBy as string[] : undefined,
        builderHint: input.builderHint as string | null | undefined,
        status: text(input.status),
      }),
    }),
  ),
  dostigus_tickets_update: tool(
    'dostigus_tickets_update',
    'Update a Ticket title, brief, blockedBy, builderHint, or status (ready, in_work, done, dropped).',
    {
      id: z.string().min(1),
      title: z.string().min(1).optional(),
      brief: z.string().optional(),
      blockedBy: z.array(z.string()).optional(),
      builderHint: z.string().nullable().optional(),
      status: z.enum(['ready', 'in_work', 'done', 'dropped']).optional(),
    },
    (input, store, who) => ({
      ticket: updateTicket(store, who, String(input.id), {
        title: text(input.title),
        brief: text(input.brief),
        blockedBy: Array.isArray(input.blockedBy) ? input.blockedBy as string[] : undefined,
        builderHint: input.builderHint as string | null | undefined,
        status: text(input.status),
      }),
    }),
  ),
  dostigus_context_search: tool(
    'dostigus_context_search',
    'Load Architect memory for this Project through the Host. The Host sets area dostigus and injects project. Do not send a Context token. mode pack with query and optional budgetBytes (512 to 65536, about 4 bytes per token, default 8192) returns one task context pack. Omit mode for an evidence search. Returns an error when Context is not configured or the Project has no contextProjectId yet.',
    {
      projectId: projectId.optional(),
      query: z.string().min(1),
      mode: z.enum(['pack']).optional(),
      budgetBytes: z.number().int().min(CONTEXT_PACK_BUDGET_MIN).max(CONTEXT_PACK_BUDGET_MAX).optional(),
    },
    (input, store, who) => proxyContextSearch(store, input, { caller: who }),
    true,
  ),
  dostigus_context_remember: tool(
    'dostigus_context_remember',
    'Write a note into Context for this Project. The Host holds the area token. The first successful remember creates the Context project (slug, projectName) and stores contextProjectId. Later calls reuse that id. Returns an error when Context is not configured.',
    {
      projectId: projectId.optional(),
      text: z.string().min(1).max(8192),
      idempotencyKey: z.string().min(1).max(128).optional(),
    },
    (input, store, who) => proxyContextRemember(store, input, { caller: who }),
  ),
  dostigus_context_read: tool(
    'dostigus_context_read',
    'Read one Context record by id (a source, a profile id profile:<project>, or a document id doc:<project>:<type>:<key>). The Host rejects a profile or document id for another Project. Returns an error when Context is not configured.',
    {
      projectId: projectId.optional(),
      id: z.string().min(1).max(220),
    },
    (input, store, who) => proxyContextRead(store, input, { caller: who }),
    true,
  ),
  dostigus_context_timeline: tool(
    'dostigus_context_timeline',
    'List recent Context sources for this Project, newest first. Optional since, until, and limit (1 to 20). The Host injects project. Returns an error when Context is not configured.',
    {
      projectId: projectId.optional(),
      since: z.string().optional(),
      until: z.string().optional(),
      limit: z.number().int().min(1).max(20).optional(),
    },
    (input, store, who) => proxyContextTimeline(store, input, { caller: who }),
    true,
  ),
}
