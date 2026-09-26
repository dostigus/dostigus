/**
 * Pack is a portable recipe. It is not a Bot and not a Module package.
 * See ADR 0039.
 */

import type { BotAccentHex, BotAvatarShape } from './bot-avatar'
import type { Skill } from './types'
import { isBotAvatarShape, normalizeBotAccentHex } from './bot-avatar'
import { isZipBytes, unzipPackFiles, zipPackFiles } from './pack-zip'
import { parseSkillDescription, parseSkillId, parseSkillInstructions, SkillInputError } from './skill'

function asPackSkill<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    if (error instanceof SkillInputError) {
      throw new PackInputError(error.message)
    }
    throw error
  }
}

function parseJsonFile(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new PackInputError(`${label} is not JSON`)
  }
}

export const PACK_FORMAT = 1
export const HOST_ENGINE_VERSION = '0.1.0'
export const PACK_ID_MAX = 65
export const PACK_SOUL_MAX = 2_000
export const PACK_README_MAX = 8_000
export const PACK_UI_FILE_MAX = 64_000
export const PACK_FILES_MAX = 80
export const PACK_ZIP_MAX_BYTES = 2_000_000

const PACK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}\.[a-z0-9][a-z0-9-]{0,31}$/
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/
const INTEGRATION_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-or-v1-[\w-]{8,}\b/g,
  /\bsk-[\w-]{12,}\b/g,
  /\b(?:ghp|github_pat)_\w{12,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/g,
  /\bBearer\s+[\w.~+/-]{12,}\b/gi,
  /\b(?:api[_-]?key|access[_-]?token|secret|password|mcp[_-]?token)\s*[:=]\s*\S+/gi,
  /\b(?:NUXT_AGENT_TOKEN|DOSTIGUS_MCP_TOKEN|OPENROUTER_API_KEY)\s*[:=]\s*\S+/g,
]

const PATH_PATTERNS: RegExp[] = [
  /(?:^|[\s"'`])(\/(?:home|Users|var|root|opt|tmp|etc)\/[^\s"'`]+)/g,
  /(?:^|[\s"'`])([A-Z]:\\[^\s"'`]+)/gi,
  /(?:^|[\s"'`])(~\/[^\s"'`]+)/g,
]

export class PackInputError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message)
    this.name = 'PackInputError'
  }
}

export type PackIntegrationStub = {
  slug: string
  reason: string
  env: string[]
}

export type PackSuggestedAppearance = {
  name?: string
  label?: string
  description?: string
  avatarShape?: BotAvatarShape
  avatarColor?: BotAccentHex
}

export type PackScheduleTemplate = {
  name: string
  cadence: 'daily' | 'weekly'
  timeLocal: string
  daysOfWeek: Array<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'> | null
  wakeText: string
}

export type PackSkillFile = Skill

export type PackUiFile = {
  path: string
  content: string
}

export type PackManifest = {
  packFormat: number
  engines: { dostigus: string }
  id: string
  version: string
  soul: string
  suggestedAppearance?: PackSuggestedAppearance
  integrations: PackIntegrationStub[]
}

export type PackTree = {
  manifest: PackManifest
  skills: PackSkillFile[]
  schedules: PackScheduleTemplate[]
  uiFiles: PackUiFile[]
  readme: string
}

export type PackEngineSeverity = 'ok' | 'warn' | 'block'

export type PackEngineGate = {
  host: string
  range: string
  ok: boolean
  severity: PackEngineSeverity
  message: string
}

export type PackSkillPlanAction = 'add' | 'replace' | 'remove'

export type PackSkillPlanRow = {
  id: string
  description: string
  action: PackSkillPlanAction
}

export type PackSchedulePlanRow = {
  name: string
  cadence: 'daily' | 'weekly'
  timeLocal: string
  paused: true
}

export type PackApplyTarget = {
  kind: 'create' | 'update'
  botId?: string
  botName?: string
  existingSkillIds?: string[]
}

export type PackApplyPlan = {
  packId: string
  version: string
  snapshotId: string
  target: 'create' | 'update'
  botId: string | null
  botName: string | null
  skills: PackSkillPlanRow[]
  schedules: PackSchedulePlanRow[]
  uiPaths: string[]
  integrations: PackIntegrationStub[]
  unboundIntegrations: PackIntegrationStub[]
  seedAppearance: boolean
  engine: PackEngineGate
  warnings: string[]
  blockers: string[]
  chatPreserved: boolean
}

export function installedPackSnapshotId(packId: string, version: string): string {
  return `${packId}@${version}`
}

export function parseInstalledPackSnapshotId(value: string): { packId: string, version: string } {
  const at = value.lastIndexOf('@')
  if (at <= 0) {
    throw new PackInputError('Installed Pack id must be author.slug@version')
  }
  return {
    packId: parsePackId(value.slice(0, at)),
    version: parsePackVersion(value.slice(at + 1)),
  }
}

export function parsePackId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new PackInputError('Pack id is required')
  }
  const id = value.trim()
  if (!PACK_ID_PATTERN.test(id) || id.length > PACK_ID_MAX) {
    throw new PackInputError('Pack id must be author.slug')
  }
  return id
}

export function parsePackVersion(value: unknown): string {
  if (typeof value !== 'string' || !SEMVER_PATTERN.test(value.trim())) {
    throw new PackInputError('Pack version must be semver')
  }
  return value.trim()
}

export function slugifyPackPart(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
  return slug || 'pack'
}

export function parseSemver(value: string): { major: number, minor: number, patch: number } {
  const match = SEMVER_PATTERN.exec(value.trim())
  if (!match) {
    throw new PackInputError('Pack version must be semver')
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function compareSemver(left: string, right: string): number {
  const a = parseSemver(left)
  const b = parseSemver(right)
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

function bumpPatch(version: string): string {
  const parsed = parseSemver(version)
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`
}

export function nextPackVersion(version: string | null | undefined): string {
  if (!version) {
    return '1.0.0'
  }
  return bumpPatch(version)
}

/**
 * Day-1 ranges: `*`, exact, `^`, `~`, `>=`, `>`, `<=`, `<`, and
 * space-separated AND clauses.
 */
export function satisfiesEngineRange(version: string, range: string): boolean {
  const clauses = range.trim().split(/\s+/).filter(Boolean)
  if (clauses.length === 0 || clauses.includes('*')) {
    return true
  }
  return clauses.every((clause) => {
    if (clause === '*') {
      return true
    }
    const caret = /^\^(\d+\.\d+\.\d+)$/.exec(clause)
    if (caret) {
      const base = parseSemver(caret[1]!)
      const host = parseSemver(version)
      if (base.major === 0) {
        return host.major === 0 && host.minor === base.minor && host.patch >= base.patch
      }
      return host.major === base.major && compareSemver(version, caret[1]!) >= 0
    }
    const tilde = /^~(\d+\.\d+\.\d+)$/.exec(clause)
    if (tilde) {
      const base = parseSemver(tilde[1]!)
      const host = parseSemver(version)
      return host.major === base.major && host.minor === base.minor && host.patch >= base.patch
    }
    const cmp = /^(>=|>|<=|[<=])?(\d+\.\d+\.\d+)$/.exec(clause)
    if (!cmp) {
      throw new PackInputError('engines.dostigus is not a semver range')
    }
    const op = cmp[1] || '='
    const target = cmp[2]!
    const delta = compareSemver(version, target)
    if (op === '>') {
      return delta > 0
    }
    if (op === '>=') {
      return delta >= 0
    }
    if (op === '<') {
      return delta < 0
    }
    if (op === '<=') {
      return delta <= 0
    }
    return delta === 0
  })
}

export function hostEngineGate(range: string, host = HOST_ENGINE_VERSION): PackEngineGate {
  let ok = false
  try {
    ok = satisfiesEngineRange(host, range)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'engines.dostigus is not a semver range'
    return {
      host,
      range,
      ok: false,
      severity: 'block',
      message,
    }
  }
  if (ok) {
    return { host, range, ok: true, severity: 'ok', message: '' }
  }
  return {
    host,
    range,
    ok: false,
    severity: 'warn',
    message: `Host ${host} is outside engines.dostigus (${range})`,
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PackInputError(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function optionalString(value: unknown, max: number, label: string): string {
  if (value == null) {
    return ''
  }
  if (typeof value !== 'string') {
    throw new PackInputError(`${label} must be text`)
  }
  const trimmed = value.trim()
  if (trimmed.length > max) {
    throw new PackInputError(`${label} must be ${max} characters or fewer`)
  }
  return trimmed
}

function parseIntegrations(value: unknown): PackIntegrationStub[] {
  if (value == null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new PackInputError('integrations must be an array')
  }
  return value.map((item, index) => {
    const row = asRecord(item, `integrations[${index}]`)
    if (typeof row.slug !== 'string' || !INTEGRATION_SLUG_PATTERN.test(row.slug.trim())) {
      throw new PackInputError('Integration slug must be a lowercase slug')
    }
    const reason = optionalString(row.reason, 200, 'Integration reason')
    if (!reason) {
      throw new PackInputError('Integration reason is required')
    }
    if (row.value != null || row.secret != null || row.apiKey != null) {
      throw new PackInputError('Integration stubs never include values')
    }
    if (!Array.isArray(row.env)) {
      throw new PackInputError('Integration env must be name strings')
    }
    const env = row.env.map((name) => {
      if (typeof name !== 'string' || !ENV_NAME_PATTERN.test(name.trim())) {
        throw new PackInputError('Integration env is names only')
      }
      if (/=/.test(name) || name.includes(' ')) {
        throw new PackInputError('Integration env is names only')
      }
      return name.trim()
    })
    return { slug: row.slug.trim(), reason, env }
  })
}

function parseSuggestedAppearance(value: unknown): PackSuggestedAppearance | undefined {
  if (value == null) {
    return undefined
  }
  const row = asRecord(value, 'suggestedAppearance')
  const next: PackSuggestedAppearance = {}
  const name = optionalString(row.name, 120, 'suggestedAppearance.name')
  if (name) {
    next.name = name
  }
  const label = optionalString(row.label, 160, 'suggestedAppearance.label')
  if (label) {
    next.label = label
  }
  const description = optionalString(row.description, PACK_SOUL_MAX, 'suggestedAppearance.description')
  if (description) {
    next.description = description
  }
  if (row.avatarShape != null) {
    if (typeof row.avatarShape !== 'string' || !isBotAvatarShape(row.avatarShape)) {
      throw new PackInputError('Unknown suggestedAppearance.avatarShape')
    }
    next.avatarShape = row.avatarShape
  }
  if (row.avatarColor != null) {
    if (typeof row.avatarColor !== 'string') {
      throw new PackInputError('Unknown suggestedAppearance.avatarColor')
    }
    const hex = normalizeBotAccentHex(row.avatarColor)
    if (!hex) {
      throw new PackInputError('Unknown suggestedAppearance.avatarColor')
    }
    next.avatarColor = hex
  }
  return Object.keys(next).length > 0 ? next : undefined
}

export function parsePackManifest(value: unknown): PackManifest {
  const row = asRecord(value, 'pack.json')
  if (row.packFormat !== PACK_FORMAT && typeof row.packFormat !== 'number') {
    throw new PackInputError('packFormat is required')
  }
  if (typeof row.packFormat !== 'number' || !Number.isInteger(row.packFormat) || row.packFormat < 1) {
    throw new PackInputError('packFormat must be a positive integer')
  }
  const engines = asRecord(row.engines, 'engines')
  if (typeof engines.dostigus !== 'string' || !engines.dostigus.trim()) {
    throw new PackInputError('engines.dostigus is required')
  }
  return {
    packFormat: row.packFormat,
    engines: { dostigus: engines.dostigus.trim() },
    id: parsePackId(row.id),
    version: parsePackVersion(row.version),
    soul: optionalString(row.soul, PACK_SOUL_MAX, 'soul'),
    suggestedAppearance: parseSuggestedAppearance(row.suggestedAppearance),
    integrations: parseIntegrations(row.integrations),
  }
}

function parseFrontMatter(raw: string): { description: string, body: string } {
  const crlf = raw.startsWith('---\r\n')
  const lf = raw.startsWith('---\n')
  if (!crlf && !lf) {
    return { description: '', body: raw }
  }
  const rest = raw.slice(crlf ? 5 : 4)
  const end = crlf ? rest.indexOf('\r\n---') : rest.indexOf('\n---')
  if (end < 0) {
    return { description: '', body: raw }
  }
  const header = rest.slice(0, end)
  let after = rest.slice(end + (crlf ? 5 : 4))
  if (after.startsWith('\r\n')) {
    after = after.slice(2)
  } else if (after.startsWith('\n')) {
    after = after.slice(1)
  }
  let description = ''
  for (const line of header.split(/\r?\n/)) {
    if (line.startsWith('description:')) {
      description = line.slice('description:'.length).trim().replace(/^["']|["']$/g, '')
    }
  }
  return { description, body: after }
}

function parseSkillFile(idRaw: string, raw: string): PackSkillFile {
  return asPackSkill(() => {
    const id = parseSkillId(idRaw)
    const parsed = parseFrontMatter(raw)
    const description = parsed.description || `Skill ${id}`
    return {
      id,
      description: parseSkillDescription(description),
      instructions: parseSkillInstructions(parsed.body),
    }
  })
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
type PackWeekday = (typeof WEEKDAYS)[number]

function isWeekday(value: string): value is PackWeekday {
  return (WEEKDAYS as readonly string[]).includes(value)
}

function parseScheduleTemplate(value: unknown, fallbackName: string): PackScheduleTemplate {
  const row = asRecord(value, 'schedule')
  if (row.enabled === true) {
    // Templates may mention enabled; Apply still lands paused.
  }
  const name = optionalString(row.name, 80, 'Schedule name') || fallbackName
  const cadence = row.cadence
  if (cadence !== 'daily' && cadence !== 'weekly') {
    throw new PackInputError('Schedule cadence must be daily or weekly')
  }
  if (typeof row.timeLocal !== 'string' || !/^\d{1,2}:\d{2}$/.test(row.timeLocal.trim())) {
    throw new PackInputError('Schedule timeLocal must be HH:MM')
  }
  const [hour, minute] = row.timeLocal.trim().split(':').map(Number)
  if (hour! > 23 || minute! > 59) {
    throw new PackInputError('Schedule timeLocal must be HH:MM')
  }
  const timeLocal = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  let daysOfWeek: PackWeekday[] | null = null
  if (cadence === 'weekly') {
    if (!Array.isArray(row.daysOfWeek) || row.daysOfWeek.length === 0) {
      throw new PackInputError('Weekly Schedule needs daysOfWeek')
    }
    daysOfWeek = []
    for (const item of row.daysOfWeek) {
      if (typeof item !== 'string' || !isWeekday(item.trim().toLowerCase())) {
        throw new PackInputError('daysOfWeek uses sun–sat')
      }
      const day = item.trim().toLowerCase() as PackWeekday
      if (!daysOfWeek.includes(day)) {
        daysOfWeek.push(day)
      }
    }
  } else if (Array.isArray(row.daysOfWeek) && row.daysOfWeek.length > 0) {
    throw new PackInputError('daysOfWeek is omitted for a daily Schedule')
  }
  const wakeText = optionalString(row.wakeText, 2_000, 'wakeText')
  if (!wakeText) {
    throw new PackInputError('Schedule wakeText is required')
  }
  return { name, cadence, timeLocal, daysOfWeek, wakeText }
}

export function normalizePackPaths(files: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const [raw, content] of Object.entries(files)) {
    const path = raw.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '')
    if (!path || path.endsWith('/') || path.includes('..')) {
      throw new PackInputError('Pack path is not allowed')
    }
    if (path.startsWith('__MACOSX/') || path.endsWith('/.DS_Store') || path === '.DS_Store') {
      continue
    }
    normalized[path] = content
  }
  const keys = Object.keys(normalized)
  if (keys.includes('pack.json')) {
    return normalized
  }
  const prefixes = new Set(keys.map((key) => key.split('/')[0] ?? ''))
  if (prefixes.size === 1) {
    const root = [...prefixes][0]
    if (root && normalized[`${root}/pack.json`]) {
      const stripped: Record<string, string> = {}
      const lead = `${root}/`
      for (const [path, content] of Object.entries(normalized)) {
        stripped[path.startsWith(lead) ? path.slice(lead.length) : path] = content
      }
      return stripped
    }
  }
  throw new PackInputError('pack.json is required')
}

function skillIdFromPath(path: string): string | null {
  const folder = /^skills\/([^/]+)\/SKILL\.md$/i.exec(path)
  if (folder) {
    return folder[1] ?? null
  }
  const file = /^skills\/([^/]+)\.md$/i.exec(path)
  return file?.[1] ?? null
}

export function parsePackTreeFromFiles(files: Record<string, string>): PackTree {
  const tree = normalizePackPaths(files)
  const names = Object.keys(tree)
  if (names.length > PACK_FILES_MAX) {
    throw new PackInputError(`Pack may have ${PACK_FILES_MAX} files or fewer`)
  }
  const manifest = parsePackManifest(parseJsonFile(tree['pack.json'] ?? 'null', 'pack.json'))
  const skills: PackSkillFile[] = []
  const schedules: PackScheduleTemplate[] = []
  const uiFiles: PackUiFile[] = []
  let readme = ''

  for (const [path, content] of Object.entries(tree)) {
    if (path === 'pack.json') {
      continue
    }
    if (path === 'README' || path === 'README.md') {
      readme = optionalString(content, PACK_README_MAX, 'README')
      continue
    }
    const skillId = skillIdFromPath(path)
    if (skillId) {
      skills.push(parseSkillFile(skillId, content))
      continue
    }
    const schedule = /^schedules\/([^/]+)\.json$/.exec(path)
    if (schedule) {
      schedules.push(parseScheduleTemplate(
        parseJsonFile(content, path),
        schedule[1] ?? 'Schedule',
      ))
      continue
    }
    if (path.startsWith('ui/')) {
      const rel = path.slice('ui/'.length)
      if (!rel || rel.endsWith('/')) {
        continue
      }
      if (content.length > PACK_UI_FILE_MAX) {
        throw new PackInputError(`ui/${rel} is too large`)
      }
      if (!/^[a-z0-9][a-z0-9-]*\//.test(rel) || rel.includes('..')) {
        throw new PackInputError('ui/ files live under ui/<id>/')
      }
      uiFiles.push({ path: rel, content })
      continue
    }
    throw new PackInputError(`Unexpected Pack file: ${path}`)
  }

  skills.sort((left, right) => left.id.localeCompare(right.id))
  return { manifest, skills, schedules, uiFiles, readme }
}

export function packTreeToFiles(tree: PackTree): Record<string, string> {
  const files: Record<string, string> = {
    'pack.json': `${JSON.stringify({
      packFormat: tree.manifest.packFormat,
      engines: tree.manifest.engines,
      id: tree.manifest.id,
      version: tree.manifest.version,
      ...(tree.manifest.soul ? { soul: tree.manifest.soul } : {}),
      ...(tree.manifest.suggestedAppearance
        ? { suggestedAppearance: tree.manifest.suggestedAppearance }
        : {}),
      ...(tree.manifest.integrations.length > 0
        ? { integrations: tree.manifest.integrations }
        : {}),
    }, null, 2)}\n`,
  }
  for (const skill of tree.skills) {
    files[`skills/${skill.id}/SKILL.md`] = `---\ndescription: ${skill.description}\n---\n\n${skill.instructions}\n`
  }
  for (const [index, schedule] of tree.schedules.entries()) {
    const slug = slugifyPackPart(schedule.name || `schedule-${index + 1}`)
    files[`schedules/${slug}.json`] = `${JSON.stringify({
      name: schedule.name,
      cadence: schedule.cadence,
      timeLocal: schedule.timeLocal,
      ...(schedule.daysOfWeek ? { daysOfWeek: schedule.daysOfWeek } : {}),
      wakeText: schedule.wakeText,
    }, null, 2)}\n`
  }
  for (const file of tree.uiFiles) {
    files[`ui/${file.path}`] = file.content
  }
  if (tree.readme) {
    files.README = tree.readme.endsWith('\n') ? tree.readme : `${tree.readme}\n`
  }
  return files
}

export function packTreeToZip(tree: PackTree): Uint8Array {
  return zipPackFiles(packTreeToFiles(tree))
}

export function parsePackZip(bytes: Uint8Array): PackTree {
  if (bytes.length > PACK_ZIP_MAX_BYTES) {
    throw new PackInputError('Pack zip is too large')
  }
  return parsePackTreeFromFiles(unzipPackFiles(bytes))
}

export function parsePackUpload(input: {
  bytes?: Uint8Array
  filename?: string
  files?: Record<string, string>
}): PackTree {
  if (input.files && Object.keys(input.files).length > 0) {
    return parsePackTreeFromFiles(input.files)
  }
  if (!input.bytes || input.bytes.length === 0) {
    throw new PackInputError('Pack file is required')
  }
  if (isZipBytes(input.bytes) || (input.filename ?? '').toLowerCase().endsWith('.zip')) {
    return parsePackZip(input.bytes)
  }
  const text = new TextDecoder().decode(input.bytes)
  if ((input.filename ?? '').toLowerCase().endsWith('.json') || text.trim().startsWith('{')) {
    return parsePackTreeFromFiles({ 'pack.json': text })
  }
  throw new PackInputError('Upload a Pack zip or pack.json')
}

function redactText(value: string): { text: string, redacted: boolean } {
  let text = value
  let redacted = false
  for (const pattern of SECRET_PATTERNS) {
    const next = text.replace(pattern, '[redacted]')
    if (next !== text) {
      redacted = true
      text = next
    }
  }
  for (const pattern of PATH_PATTERNS) {
    const next = text.replace(pattern, (full, path: string) => full.replace(path, '[path]'))
    if (next !== text) {
      redacted = true
      text = next
    }
  }
  return { text, redacted }
}

export function scrubPackTree(tree: PackTree): { tree: PackTree, redacted: string[] } {
  const redacted: string[] = []
  const soul = redactText(tree.manifest.soul)
  if (soul.redacted) {
    redacted.push('soul')
  }
  const readme = redactText(tree.readme)
  if (readme.redacted) {
    redacted.push('README')
  }
  const appearance = tree.manifest.suggestedAppearance
    ? { ...tree.manifest.suggestedAppearance }
    : undefined
  if (appearance?.description) {
    const desc = redactText(appearance.description)
    appearance.description = desc.text
    if (desc.redacted) {
      redacted.push('suggestedAppearance.description')
    }
  }
  const skills = tree.skills.map((skill) => {
    const description = redactText(skill.description)
    const instructions = redactText(skill.instructions)
    if (description.redacted || instructions.redacted) {
      redacted.push(`skills/${skill.id}`)
    }
    return {
      id: skill.id,
      description: description.text || `Skill ${skill.id}`,
      instructions: instructions.text || '[redacted]',
    }
  })
  const schedules = tree.schedules.map((schedule) => {
    const name = redactText(schedule.name)
    const wakeText = redactText(schedule.wakeText)
    if (name.redacted || wakeText.redacted) {
      redacted.push(`schedules/${schedule.name || 'schedule'}`)
    }
    return {
      ...schedule,
      name: name.text,
      wakeText: wakeText.text || '[redacted]',
    }
  })
  const uiFiles = tree.uiFiles.map((file) => {
    const content = redactText(file.content)
    if (content.redacted) {
      redacted.push(`ui/${file.path}`)
    }
    return { path: file.path, content: content.text }
  })
  return {
    tree: {
      manifest: {
        ...tree.manifest,
        soul: soul.text,
        suggestedAppearance: appearance,
        integrations: tree.manifest.integrations.map((stub) => ({
          slug: stub.slug,
          reason: redactText(stub.reason).text,
          env: stub.env,
        })),
      },
      skills,
      schedules,
      uiFiles,
      readme: readme.text,
    },
    redacted,
  }
}

export function assertNoSecretsInPack(tree: PackTree): void {
  const blob = JSON.stringify(packTreeToFiles(tree))
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(blob)) {
      throw new PackInputError('Pack export must not include secrets')
    }
  }
  for (const pattern of PATH_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(blob)) {
      throw new PackInputError('Pack export must not include computer paths')
    }
  }
}

export function buildApplyPlan(tree: PackTree, target: PackApplyTarget): PackApplyPlan {
  const engine = hostEngineGate(tree.manifest.engines.dostigus)
  const warnings: string[] = []
  const blockers: string[] = []
  if (tree.manifest.packFormat > PACK_FORMAT) {
    blockers.push(`packFormat ${tree.manifest.packFormat} needs a newer Host`)
  }
  if (engine.severity === 'block') {
    blockers.push(engine.message)
  } else if (engine.severity === 'warn') {
    warnings.push(engine.message)
  }
  const existing = new Set(target.existingSkillIds ?? [])
  const incoming = new Set(tree.skills.map((skill) => skill.id))
  const skills: PackSkillPlanRow[] = [
    ...tree.skills.map((skill) => ({
      id: skill.id,
      description: skill.description,
      action: (existing.has(skill.id) ? 'replace' : 'add') as PackSkillPlanAction,
    })),
    ...[...existing].filter((id) => !incoming.has(id)).map((id) => ({
      id,
      description: '',
      action: 'remove' as const,
    })),
  ]
  const schedules: PackSchedulePlanRow[] = tree.schedules.map((schedule) => ({
    name: schedule.name,
    cadence: schedule.cadence,
    timeLocal: schedule.timeLocal,
    paused: true,
  }))
  if (tree.manifest.integrations.length > 0) {
    warnings.push('Unbound integration stubs will not start tools')
  }
  if (target.kind === 'update' && !target.botId) {
    blockers.push('Name the Bot to update')
  }
  return {
    packId: tree.manifest.id,
    version: tree.manifest.version,
    snapshotId: installedPackSnapshotId(tree.manifest.id, tree.manifest.version),
    target: target.kind,
    botId: target.botId ?? null,
    botName: target.botName ?? null,
    skills,
    schedules,
    uiPaths: tree.uiFiles.map((file) => file.path),
    integrations: tree.manifest.integrations,
    unboundIntegrations: tree.manifest.integrations,
    seedAppearance: target.kind === 'create' && Boolean(tree.manifest.suggestedAppearance),
    engine,
    warnings,
    blockers,
    chatPreserved: target.kind === 'update',
  }
}

export function serializePackTree(tree: PackTree): string {
  return JSON.stringify(tree)
}

export function parsePackTreeJson(value: unknown): PackTree {
  const row = asRecord(value, 'Pack')
  const manifest = parsePackManifest(row.manifest)
  if (!Array.isArray(row.skills) || !Array.isArray(row.schedules) || !Array.isArray(row.uiFiles)) {
    throw new PackInputError('Pack tree is incomplete')
  }
  const skills = row.skills.map((item) => {
    const skill = asRecord(item, 'skill')
    return asPackSkill(() => ({
      id: parseSkillId(skill.id),
      description: parseSkillDescription(skill.description),
      instructions: parseSkillInstructions(skill.instructions),
    }))
  })
  const schedules = row.schedules.map((item, index) => parseScheduleTemplate(item, `schedule-${index + 1}`))
  const uiFiles = row.uiFiles.map((item) => {
    const file = asRecord(item, 'ui file')
    if (typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new PackInputError('ui file needs path and content')
    }
    return { path: file.path, content: file.content }
  })
  return {
    manifest,
    skills,
    schedules,
    uiFiles,
    readme: optionalString(row.readme, PACK_README_MAX, 'README'),
  }
}
