import type { Artifact } from '@dostigus/shared'
import type { OpenedStore } from './store'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { getCompleteArtifact, toPublicArtifact } from './artifacts'
import { createBot } from './queries'
import { StoreError } from './store-error'

export const PROJECT_STATUSES = ['active', 'archived'] as const
export type ProjectStatus = typeof PROJECT_STATUSES[number]

export const ARCHITECT_MODES = ['external', 'builtin'] as const
export type ArchitectMode = typeof ARCHITECT_MODES[number]

export const TASK_MODES = ['quick', 'bug', 'feature', 'epic'] as const
export type TaskMode = typeof TASK_MODES[number]

export const TASK_STATUSES = [
  'new',
  'grilling',
  'awaiting_approval',
  'in_work',
  'awaiting_acceptance',
  'released',
  'dropped',
] as const
export type TaskStatus = typeof TASK_STATUSES[number]

export const TICKET_STATUSES = ['ready', 'in_work', 'done', 'dropped'] as const
export type TicketStatus = typeof TICKET_STATUSES[number]

export const GRILL_POLICIES = ['required', 'short', 'skipped'] as const
export type GrillPolicy = typeof GRILL_POLICIES[number]

export const COMMAND_KEYS = ['setup', 'lint', 'test', 'check', 'run', 'preview'] as const
export type CommandKey = typeof COMMAND_KEYS[number]

export type FactoryCaller
  = | { kind: 'owner' }
    | { kind: 'project', projectId: string }

export type DocsLayout = {
  adrs: string
  specs: string
  glossary: string
}

export const DEFAULT_DOCS_LAYOUT: DocsLayout = {
  adrs: 'docs/adr',
  specs: 'docs',
  glossary: 'CONTEXT.md',
}

export type Commands = Record<CommandKey, string | null>

export type RepoLink = {
  id: string
  projectId: string
  provider: 'github'
  fullName: string
  defaultBranch: string
  docsLayout: DocsLayout
  commands: Commands
  createdAt: string
  updatedAt: string
}

export type Project = {
  id: string
  slug: string
  name: string
  ownerId: string
  architectBotId: string | null
  architectMode: ArchitectMode
  previewUrl: string | null
  status: ProjectStatus
  contextProjectId: string | null
  createdAt: string
  updatedAt: string
  repo: RepoLink | null
}

export type ProjectTokenView = {
  id: string
  projectId: string
  label: string
  createdAt: string
  revokedAt: string | null
}

export type IssuedProjectToken = ProjectTokenView & {
  token: string
}

export type Task = {
  id: string
  projectId: string
  title: string
  body: string
  mode: TaskMode
  status: TaskStatus
  createdBy: string
  grillPolicy: GrillPolicy
  grillSkipReason: string | null
  createdAt: string
  updatedAt: string
  attachments: Artifact[]
}

export type Ticket = {
  id: string
  taskId: string
  title: string
  brief: string
  blockedBy: string[]
  builderHint: string | null
  status: TicketStatus
  createdAt: string
  updatedAt: string
}

type ProjectSql = {
  id: string
  slug: string
  name: string
  owner_id: string
  architect_bot_id: string | null
  architect_mode: string
  preview_url: string | null
  status: string
  context_project_id: string | null
  created_at: number
  updated_at: number
}

type RepoSql = {
  id: string
  project_id: string
  provider: string
  full_name: string
  default_branch: string
  docs_layout_json: string
  created_at: number
  updated_at: number
}

type CommandSql = {
  setup: string | null
  lint: string | null
  test: string | null
  check: string | null
  run: string | null
  preview: string | null
}

type TaskSql = {
  id: string
  project_id: string
  title: string
  body: string
  mode: string
  status: string
  created_by: string
  grill_policy: string
  grill_skip_reason: string | null
  created_at: number
  updated_at: number
}

type TicketSql = {
  id: string
  task_id: string
  title: string
  brief: string
  blocked_by_json: string
  builder_hint: string | null
  status: string
  created_at: number
  updated_at: number
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/
const FULL_NAME = /^[\w.-]{1,100}\/[\w.-]{1,100}$/

function nowMs(): number {
  return Date.now()
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function writeTxn<T>(store: OpenedStore, run: () => T): T {
  store.sqlite.exec('BEGIN')
  try {
    const result = run()
    store.sqlite.exec('COMMIT')
    return result
  } catch (error) {
    store.sqlite.exec('ROLLBACK')
    throw error
  }
}

function ownerId(store: OpenedStore): string {
  const row = store.sqlite.prepare('SELECT id FROM owners LIMIT 1').get() as { id?: string } | undefined
  if (!row?.id) {
    throw new StoreError('This Cluster has no Owner', 409)
  }
  return row.id
}

export function slugFromName(name: string): string {
  let slug = ''
  let hyphen = false
  for (const char of name.trim().toLowerCase()) {
    const alnum = (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')
    if (!alnum) {
      if (slug.length > 0) {
        hyphen = true
      }
      continue
    }
    if (hyphen && slug.length < 64) {
      slug += '-'
    }
    hyphen = false
    if (slug.length >= 64) {
      break
    }
    slug += char
  }
  return assertSlug(slug)
}

function assertSlug(slug: string): string {
  if (!SLUG.test(slug)) {
    throw new StoreError('Slug must be lowercase letters, digits, and hyphens', 400)
  }
  return slug
}

function assertEnum<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new StoreError(`Invalid ${label}`, 400)
  }
  return value as T
}

function capped(value: string, max: number, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new StoreError(`${label} is required`, 400)
  }
  if (trimmed.length > max) {
    throw new StoreError(`${label} is too long`, 400)
  }
  return trimmed
}

function optionalText(value: string | null | undefined, max: number, label: string): string | null {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length > max) {
    throw new StoreError(`${label} is too long`, 400)
  }
  return trimmed
}

function optionalBody(value: string | undefined, max: number, label: string): string {
  if (value === undefined) {
    return ''
  }
  if (value.length > max) {
    throw new StoreError(`${label} is too long`, 400)
  }
  return value
}

function assertPreviewUrl(value: string | null | undefined): string | null {
  if (value === undefined || value === null || !value.trim()) {
    return null
  }
  const url = value.trim()
  if (url.length > 500 || !/^https?:\/\//.test(url)) {
    throw new StoreError('Preview URL must be an http(s) URL', 400)
  }
  return url
}

function assertRelativePath(value: string, label: string): string {
  const path = value.trim()
  if (!path || path.length > 200 || path.startsWith('/') || path.includes('..') || path.includes('\\')) {
    throw new StoreError(`${label} must be a relative path`, 400)
  }
  return path
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function policyForMode(mode: TaskMode): GrillPolicy {
  return mode === 'bug' ? 'short' : 'required'
}

function assertGrill(mode: TaskMode, policy: GrillPolicy, reason: string | null): string | null {
  if (policy === 'skipped') {
    if (mode !== 'quick') {
      throw new StoreError('Only a quick Task can skip the Grill', 400)
    }
    if (!reason) {
      throw new StoreError('A quick Task needs a written reason to skip the Grill', 400)
    }
    return reason
  }
  if (mode === 'bug' && policy !== 'short') {
    throw new StoreError('A bug Task keeps a short Grill', 400)
  }
  if ((mode === 'feature' || mode === 'epic') && policy !== 'required') {
    throw new StoreError('A feature or epic Task requires a Grill', 400)
  }
  return null
}

function projectRow(store: OpenedStore, id: string): ProjectSql | undefined {
  return store.sqlite.prepare(`
    SELECT id, slug, name, owner_id, architect_bot_id, architect_mode, preview_url,
      status, context_project_id, created_at, updated_at
    FROM projects
    WHERE id = ?
  `).get(id) as ProjectSql | undefined
}

function requireProjectRow(store: OpenedStore, id: string): ProjectSql {
  const row = projectRow(store, id)
  if (!row) {
    throw new StoreError('Project not found', 404)
  }
  return row
}

export function projectForCaller(store: OpenedStore, caller: FactoryCaller, projectId?: string): Project {
  const id = caller.kind === 'project' ? caller.projectId : projectId
  if (caller.kind === 'project' && projectId && projectId !== caller.projectId) {
    throw new StoreError('This token is scoped to another Project', 403)
  }
  if (!id) {
    throw new StoreError('projectId is required', 400)
  }
  const row = projectRow(store, id)
  if (!row) {
    throw new StoreError('Project not found', 404)
  }
  return toProject(store, row)
}

function emptyCommands(): Commands {
  return { setup: null, lint: null, test: null, check: null, run: null, preview: null }
}

function commandsFor(store: OpenedStore, repoLinkId: string): Commands {
  const row = store.sqlite.prepare(`
    SELECT setup, lint, test, "check", run, preview
    FROM commands
    WHERE repo_link_id = ?
  `).get(repoLinkId) as CommandSql | undefined
  if (!row) {
    return emptyCommands()
  }
  return {
    setup: row.setup,
    lint: row.lint,
    test: row.test,
    check: row.check,
    run: row.run,
    preview: row.preview,
  }
}

function parseDocs(json: string): DocsLayout {
  try {
    const parsed = JSON.parse(json) as Partial<DocsLayout>
    return {
      adrs: typeof parsed.adrs === 'string' ? parsed.adrs : DEFAULT_DOCS_LAYOUT.adrs,
      specs: typeof parsed.specs === 'string' ? parsed.specs : DEFAULT_DOCS_LAYOUT.specs,
      glossary: typeof parsed.glossary === 'string' ? parsed.glossary : DEFAULT_DOCS_LAYOUT.glossary,
    }
  } catch {
    return { ...DEFAULT_DOCS_LAYOUT }
  }
}

function repoFor(store: OpenedStore, projectId: string): RepoLink | null {
  const row = store.sqlite.prepare(`
    SELECT id, project_id, provider, full_name, default_branch, docs_layout_json, created_at, updated_at
    FROM repo_links
    WHERE project_id = ?
  `).get(projectId) as RepoSql | undefined
  if (!row) {
    return null
  }
  return {
    id: row.id,
    projectId: row.project_id,
    provider: 'github',
    fullName: row.full_name,
    defaultBranch: row.default_branch,
    docsLayout: parseDocs(row.docs_layout_json),
    commands: commandsFor(store, row.id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function toProject(store: OpenedStore, row: ProjectSql): Project {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ownerId: row.owner_id,
    architectBotId: row.architect_bot_id,
    architectMode: assertEnum(row.architect_mode, ARCHITECT_MODES, 'architect mode'),
    previewUrl: row.preview_url,
    status: assertEnum(row.status, PROJECT_STATUSES, 'project status'),
    contextProjectId: row.context_project_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    repo: repoFor(store, row.id),
  }
}

export function listProjects(store: OpenedStore, caller: FactoryCaller): Project[] {
  if (caller.kind === 'project') {
    return [projectForCaller(store, caller)]
  }
  const rows = store.sqlite.prepare(`
    SELECT id, slug, name, owner_id, architect_bot_id, architect_mode, preview_url,
      status, context_project_id, created_at, updated_at
    FROM projects
    ORDER BY updated_at DESC, id DESC
  `).all() as ProjectSql[]
  return rows.map((row) => toProject(store, row))
}

export function createProject(
  store: OpenedStore,
  caller: FactoryCaller,
  input: { name: string, slug?: string, previewUrl?: string | null },
): Project {
  if (caller.kind === 'project') {
    throw new StoreError('Only the Owner token can create a Project', 403)
  }
  const name = capped(input.name, 120, 'Name')
  const slug = input.slug ? assertSlug(input.slug.trim()) : slugFromName(name)
  const previewUrl = assertPreviewUrl(input.previewUrl)
  const taken = store.sqlite.prepare('SELECT id FROM projects WHERE slug = ?').get(slug)
  if (taken) {
    throw new StoreError('A Project with that slug already exists', 409)
  }
  const id = randomUUID()
  const now = nowMs()
  const owner = ownerId(store)
  return writeTxn(store, () => {
    const bot = createBot(store, {
      name,
      label: 'Architect',
      description: 'Architect for this Project.',
      createdBy: owner,
    })
    store.sqlite.prepare(`
      INSERT INTO projects (
        id, slug, name, owner_id, architect_bot_id, architect_mode, preview_url,
        status, context_project_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'external', ?, 'active', NULL, ?, ?)
    `).run(id, slug, name, owner, bot.bot.id, previewUrl, now, now)
    return projectForCaller(store, caller, id)
  })
}

export function updateProject(
  store: OpenedStore,
  caller: FactoryCaller,
  projectId: string | undefined,
  input: {
    name?: string
    previewUrl?: string | null
    status?: string
    architectMode?: string
  },
): Project {
  const current = projectForCaller(store, caller, projectId)
  const name = input.name === undefined ? current.name : capped(input.name, 120, 'Name')
  const previewUrl = input.previewUrl === undefined ? current.previewUrl : assertPreviewUrl(input.previewUrl)
  const status = input.status === undefined
    ? current.status
    : assertEnum(input.status, PROJECT_STATUSES, 'project status')
  const architectMode = input.architectMode === undefined
    ? current.architectMode
    : assertEnum(input.architectMode, ARCHITECT_MODES, 'architect mode')
  const now = nowMs()
  store.sqlite.prepare(`
    UPDATE projects
    SET name = ?, preview_url = ?, status = ?, architect_mode = ?, updated_at = ?
    WHERE id = ?
  `).run(name, previewUrl, status, architectMode, now, current.id)
  if (input.name !== undefined && current.architectBotId) {
    store.sqlite.prepare('UPDATE bots SET name = ? WHERE id = ?').run(name, current.architectBotId)
  }
  return projectForCaller(store, caller, current.id)
}

export function bindContextProject(store: OpenedStore, projectId: string, contextProjectId: string): Project {
  const id = assertSlug(contextProjectId)
  const row = requireProjectRow(store, projectId)
  if (row.context_project_id && row.context_project_id !== id) {
    throw new StoreError('Project already has a Context project', 409)
  }
  if (!row.context_project_id) {
    store.sqlite.prepare(`
      UPDATE projects SET context_project_id = ?, updated_at = ? WHERE id = ?
    `).run(id, nowMs(), projectId)
  }
  return projectForCaller(store, { kind: 'owner' }, projectId)
}

export function linkRepo(
  store: OpenedStore,
  caller: FactoryCaller,
  projectId: string | undefined,
  input: {
    fullName: string
    defaultBranch?: string
    docsLayout?: Partial<DocsLayout>
  },
): Project {
  const project = projectForCaller(store, caller, projectId)
  const fullName = input.fullName.trim()
  if (!FULL_NAME.test(fullName)) {
    throw new StoreError('Repo link fullName must look like owner/repo', 400)
  }
  const branch = capped(input.defaultBranch ?? 'main', 200, 'Default branch')
  const docsLayout: DocsLayout = {
    adrs: assertRelativePath(input.docsLayout?.adrs ?? DEFAULT_DOCS_LAYOUT.adrs, 'ADRs path'),
    specs: assertRelativePath(input.docsLayout?.specs ?? DEFAULT_DOCS_LAYOUT.specs, 'Specs path'),
    glossary: assertRelativePath(input.docsLayout?.glossary ?? DEFAULT_DOCS_LAYOUT.glossary, 'Glossary path'),
  }
  const now = nowMs()
  const existing = store.sqlite.prepare('SELECT id FROM repo_links WHERE project_id = ?').get(project.id) as { id: string } | undefined
  if (existing) {
    store.sqlite.prepare(`
      UPDATE repo_links
      SET full_name = ?, default_branch = ?, docs_layout_json = ?, updated_at = ?
      WHERE id = ?
    `).run(fullName, branch, JSON.stringify(docsLayout), now, existing.id)
  } else {
    const repoId = randomUUID()
    writeTxn(store, () => {
      store.sqlite.prepare(`
        INSERT INTO repo_links (
          id, project_id, provider, full_name, default_branch, docs_layout_json, created_at, updated_at
        )
        VALUES (?, ?, 'github', ?, ?, ?, ?, ?)
      `).run(repoId, project.id, fullName, branch, JSON.stringify(docsLayout), now, now)
      store.sqlite.prepare(`
        INSERT INTO commands (id, repo_link_id, setup, lint, test, "check", run, preview, updated_at)
        VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)
      `).run(randomUUID(), repoId, now)
    })
  }
  return projectForCaller(store, caller, project.id)
}

export function setCommands(
  store: OpenedStore,
  caller: FactoryCaller,
  projectId: string | undefined,
  input: Partial<Record<CommandKey, string | null>>,
): Project {
  const project = projectForCaller(store, caller, projectId)
  if (!project.repo) {
    throw new StoreError('Link a repo before setting Commands', 400)
  }
  const next: Commands = { ...project.repo.commands }
  for (const key of COMMAND_KEYS) {
    if (key in input) {
      next[key] = optionalText(input[key], 500, key)
    }
  }
  store.sqlite.prepare(`
    UPDATE commands
    SET setup = ?, lint = ?, test = ?, "check" = ?, run = ?, preview = ?, updated_at = ?
    WHERE repo_link_id = ?
  `).run(next.setup, next.lint, next.test, next.check, next.run, next.preview, nowMs(), project.repo.id)
  return projectForCaller(store, caller, project.id)
}

export function issueProjectToken(
  store: OpenedStore,
  projectId: string,
  label = '',
): IssuedProjectToken {
  requireProjectRow(store, projectId)
  const token = `dp_${randomBytes(32).toString('base64url')}`
  const id = randomUUID()
  const now = nowMs()
  const cleanLabel = optionalText(label, 80, 'Label') ?? ''
  store.sqlite.prepare(`
    INSERT INTO project_tokens (id, project_id, token_hash, label, created_at, revoked_at)
    VALUES (?, ?, ?, ?, ?, NULL)
  `).run(id, projectId, hashToken(token), cleanLabel, now)
  return {
    id,
    projectId,
    label: cleanLabel,
    createdAt: iso(now),
    revokedAt: null,
    token,
  }
}

export function listProjectTokens(store: OpenedStore, projectId: string): ProjectTokenView[] {
  requireProjectRow(store, projectId)
  const rows = store.sqlite.prepare(`
    SELECT id, project_id, label, created_at, revoked_at
    FROM project_tokens
    WHERE project_id = ?
    ORDER BY created_at DESC
  `).all(projectId) as Array<{
    id: string
    project_id: string
    label: string
    created_at: number
    revoked_at: number | null
  }>
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    createdAt: iso(row.created_at),
    revokedAt: row.revoked_at ? iso(row.revoked_at) : null,
  }))
}

export function revokeProjectToken(store: OpenedStore, projectId: string, tokenId: string): ProjectTokenView {
  const row = store.sqlite.prepare(`
    SELECT id, project_id, label, created_at, revoked_at
    FROM project_tokens
    WHERE id = ? AND project_id = ?
  `).get(tokenId, projectId) as {
    id: string
    project_id: string
    label: string
    created_at: number
    revoked_at: number | null
  } | undefined
  if (!row) {
    throw new StoreError('Project token not found', 404)
  }
  const revokedAt = row.revoked_at ?? nowMs()
  if (!row.revoked_at) {
    store.sqlite.prepare('UPDATE project_tokens SET revoked_at = ? WHERE id = ?').run(revokedAt, tokenId)
  }
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    createdAt: iso(row.created_at),
    revokedAt: iso(revokedAt),
  }
}

export function findProjectIdByToken(store: OpenedStore, token: string): string | undefined {
  const row = store.sqlite.prepare(`
    SELECT project_id
    FROM project_tokens
    WHERE token_hash = ? AND revoked_at IS NULL
  `).get(hashToken(token)) as { project_id?: string } | undefined
  return row?.project_id
}

function taskRow(store: OpenedStore, id: string): TaskSql | undefined {
  return store.sqlite.prepare(`
    SELECT id, project_id, title, body, mode, status, created_by, grill_policy,
      grill_skip_reason, created_at, updated_at
    FROM tasks
    WHERE id = ?
  `).get(id) as TaskSql | undefined
}

function attachmentsFor(store: OpenedStore, taskId: string): Artifact[] {
  const rows = store.sqlite.prepare(`
    SELECT a.id, a.filename, a.mime, a.byte_size, a.content_hash, a.actor_person_id,
      a.created_at, a.upload_id, a.status, a.last_joined_at
    FROM task_artifacts ta
    JOIN artifacts a ON a.id = ta.artifact_id
    WHERE ta.task_id = ?
    ORDER BY ta.created_at ASC
  `).all(taskId) as Array<{
    id: string
    filename: string
    mime: string
    byte_size: number
    content_hash: string
    actor_person_id: string
    created_at: number
    upload_id: string | null
    status: string
    last_joined_at: number | null
  }>
  return rows.map((row) => toPublicArtifact(row))
}

function toTask(store: OpenedStore, row: TaskSql): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    body: row.body,
    mode: assertEnum(row.mode, TASK_MODES, 'task mode'),
    status: assertEnum(row.status, TASK_STATUSES, 'task status'),
    createdBy: row.created_by,
    grillPolicy: assertEnum(row.grill_policy, GRILL_POLICIES, 'grill policy'),
    grillSkipReason: row.grill_skip_reason,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    attachments: attachmentsFor(store, row.id),
  }
}

export function listTasks(store: OpenedStore, caller: FactoryCaller, projectId?: string): Task[] {
  const project = projectForCaller(store, caller, projectId)
  const rows = store.sqlite.prepare(`
    SELECT id, project_id, title, body, mode, status, created_by, grill_policy,
      grill_skip_reason, created_at, updated_at
    FROM tasks
    WHERE project_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(project.id) as TaskSql[]
  return rows.map((row) => toTask(store, row))
}

export function getTask(store: OpenedStore, caller: FactoryCaller, taskId: string): Task {
  const row = taskRow(store, taskId)
  if (!row) {
    throw new StoreError('Task not found', 404)
  }
  projectForCaller(store, caller, row.project_id)
  return toTask(store, row)
}

export function createTask(
  store: OpenedStore,
  caller: FactoryCaller,
  projectId: string | undefined,
  input: { title: string, body?: string, mode: string },
): Task {
  const project = projectForCaller(store, caller, projectId)
  const title = capped(input.title, 200, 'Title')
  const body = optionalBody(input.body, 20_000, 'Body')
  const mode = assertEnum(input.mode, TASK_MODES, 'task mode')
  const policy = policyForMode(mode)
  const id = randomUUID()
  const now = nowMs()
  store.sqlite.prepare(`
    INSERT INTO tasks (
      id, project_id, title, body, mode, status, created_by, grill_policy,
      grill_skip_reason, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'new', ?, ?, NULL, ?, ?)
  `).run(id, project.id, title, body, mode, ownerId(store), policy, now, now)
  return getTask(store, caller, id)
}

export function updateTask(
  store: OpenedStore,
  caller: FactoryCaller,
  taskId: string,
  input: {
    title?: string
    body?: string
    mode?: string
    grillPolicy?: string
    grillSkipReason?: string | null
  },
): Task {
  const current = getTask(store, caller, taskId)
  const title = input.title === undefined ? current.title : capped(input.title, 200, 'Title')
  const body = input.body === undefined ? current.body : optionalBody(input.body, 20_000, 'Body')
  const mode = input.mode === undefined ? current.mode : assertEnum(input.mode, TASK_MODES, 'task mode')
  const policy = input.grillPolicy === undefined
    ? (input.mode === undefined ? current.grillPolicy : policyForMode(mode))
    : assertEnum(input.grillPolicy, GRILL_POLICIES, 'grill policy')
  const reason = input.grillSkipReason === undefined
    ? current.grillSkipReason
    : optionalText(input.grillSkipReason, 500, 'Grill skip reason')
  const grillSkipReason = assertGrill(mode, policy, policy === 'skipped' ? reason : null)
  store.sqlite.prepare(`
    UPDATE tasks
    SET title = ?, body = ?, mode = ?, grill_policy = ?, grill_skip_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(title, body, mode, policy, grillSkipReason, nowMs(), taskId)
  return getTask(store, caller, taskId)
}

export function transitionTask(
  store: OpenedStore,
  caller: FactoryCaller,
  taskId: string,
  status: string,
): Task {
  const current = getTask(store, caller, taskId)
  const next = assertEnum(status, TASK_STATUSES, 'task status')
  store.sqlite.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(next, nowMs(), current.id)
  return getTask(store, caller, taskId)
}

export function attachTaskArtifact(store: OpenedStore, caller: FactoryCaller, taskId: string, artifactId: string): Task {
  const task = getTask(store, caller, taskId)
  const artifact = getCompleteArtifact(store, artifactId)
  if (!artifact) {
    throw new StoreError('Artifact not found', 404)
  }
  store.sqlite.prepare(`
    INSERT OR IGNORE INTO task_artifacts (task_id, artifact_id, created_at)
    VALUES (?, ?, ?)
  `).run(task.id, artifactId, nowMs())
  return getTask(store, caller, taskId)
}

function parseBlockedBy(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      return []
    }
    return parsed
  } catch {
    return []
  }
}

function assertBlockedBy(store: OpenedStore, taskId: string, ids: string[], selfId?: string): string[] {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (selfId && unique.includes(selfId)) {
    throw new StoreError('A Ticket cannot block itself', 400)
  }
  for (const id of unique) {
    const row = store.sqlite.prepare('SELECT task_id FROM tickets WHERE id = ?').get(id) as { task_id?: string } | undefined
    if (!row || row.task_id !== taskId) {
      throw new StoreError('blockedBy must name Tickets on this Task', 400)
    }
  }
  return unique
}

function toTicket(row: TicketSql): Ticket {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    brief: row.brief,
    blockedBy: parseBlockedBy(row.blocked_by_json),
    builderHint: row.builder_hint,
    status: assertEnum(row.status, TICKET_STATUSES, 'ticket status'),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function ticketRow(store: OpenedStore, id: string): TicketSql | undefined {
  return store.sqlite.prepare(`
    SELECT id, task_id, title, brief, blocked_by_json, builder_hint, status, created_at, updated_at
    FROM tickets
    WHERE id = ?
  `).get(id) as TicketSql | undefined
}

export function listTickets(store: OpenedStore, caller: FactoryCaller, taskId: string): Ticket[] {
  getTask(store, caller, taskId)
  const rows = store.sqlite.prepare(`
    SELECT id, task_id, title, brief, blocked_by_json, builder_hint, status, created_at, updated_at
    FROM tickets
    WHERE task_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(taskId) as TicketSql[]
  return rows.map(toTicket)
}

export function createTicket(
  store: OpenedStore,
  caller: FactoryCaller,
  taskId: string,
  input: {
    title: string
    brief?: string
    blockedBy?: string[]
    builderHint?: string | null
    status?: string
  },
): Ticket {
  getTask(store, caller, taskId)
  const title = capped(input.title, 200, 'Title')
  const brief = optionalBody(input.brief, 20_000, 'Brief')
  const blockedBy = assertBlockedBy(store, taskId, input.blockedBy ?? [])
  const builderHint = optionalText(input.builderHint, 500, 'Builder hint')
  const status = input.status === undefined ? 'ready' : assertEnum(input.status, TICKET_STATUSES, 'ticket status')
  const id = randomUUID()
  const now = nowMs()
  store.sqlite.prepare(`
    INSERT INTO tickets (
      id, task_id, title, brief, blocked_by_json, builder_hint, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, taskId, title, brief, JSON.stringify(blockedBy), builderHint, status, now, now)
  const row = ticketRow(store, id)
  if (!row) {
    throw new StoreError('Ticket not found', 404)
  }
  return toTicket(row)
}

export function updateTicket(
  store: OpenedStore,
  caller: FactoryCaller,
  ticketId: string,
  input: {
    title?: string
    brief?: string
    blockedBy?: string[]
    builderHint?: string | null
    status?: string
  },
): Ticket {
  const currentRow = ticketRow(store, ticketId)
  if (!currentRow) {
    throw new StoreError('Ticket not found', 404)
  }
  getTask(store, caller, currentRow.task_id)
  const current = toTicket(currentRow)
  const title = input.title === undefined ? current.title : capped(input.title, 200, 'Title')
  const brief = input.brief === undefined ? current.brief : optionalBody(input.brief, 20_000, 'Brief')
  const blockedBy = input.blockedBy === undefined
    ? current.blockedBy
    : assertBlockedBy(store, current.taskId, input.blockedBy, ticketId)
  const builderHint = input.builderHint === undefined
    ? current.builderHint
    : optionalText(input.builderHint, 500, 'Builder hint')
  const status = input.status === undefined
    ? current.status
    : assertEnum(input.status, TICKET_STATUSES, 'ticket status')
  store.sqlite.prepare(`
    UPDATE tickets
    SET title = ?, brief = ?, blocked_by_json = ?, builder_hint = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(title, brief, JSON.stringify(blockedBy), builderHint, status, nowMs(), ticketId)
  const row = ticketRow(store, ticketId)
  if (!row) {
    throw new StoreError('Ticket not found', 404)
  }
  return toTicket(row)
}
