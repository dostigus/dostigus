/**
 * Pack export and Apply. A Pack is not a Bot and not a Module package.
 * See ADR 0039.
 */

import type {
  Bot,
  BotViewer,
  PackApplyPlan,
  PackApplyTarget,
  PackScheduleNameLocale,
  PackTree,
} from '@dostigus/shared'
import type { OpenedStore } from './store'
import {
  assertNoSecretsInPack,
  buildApplyPlan,
  canEditBot,
  HOST_ENGINE_VERSION,
  installedPackSnapshotId,
  inventPackScheduleName,
  nextPackVersion,
  PACK_README_MAX,
  packBotSlugNeedsSheet,
  PackInputError,
  parseInstalledPackSnapshotId,
  parsePackId,
  parsePackTreeJson,
  parsePackVersion,
  randomBotAppearance,
  scrubPackTree,
  serializePackTree,
  slugifyPackPart,
} from '@dostigus/shared'
import { isHostSeedSkillId } from './meta-skills'
import { getOwner } from './owners'
import { createBot, getClusterOwnerId, listMessages, requireBot, viewerMaySeeBot } from './queries'
import { createSchedule, deleteSchedule, listSchedules } from './schedules'
import { listBotSkills, replaceBotSkills } from './skills'
import { StoreError } from './store-error'

function asPack<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    if (error instanceof PackInputError) {
      throw new StoreError(error.message, error.statusCode)
    }
    throw error
  }
}

function authorSlug(store: OpenedStore): string {
  const ownerId = getClusterOwnerId(store)
  const owner = ownerId ? getOwner(store, ownerId) : undefined
  if (owner?.username) {
    return slugifyPackPart(owner.username)
  }
  if (owner?.email) {
    return slugifyPackPart(owner.email.split('@')[0] ?? 'cluster')
  }
  return 'cluster'
}

export type PackExportWrite = {
  botSlug?: string
  version?: string
  readme?: string
  locale?: PackScheduleNameLocale
}

export type PackExportReason = 'empty-slug' | 'conflict' | 're-export'

export type PackExportPreview = {
  author: string
  botSlug: string
  version: string
  id: string
  readme: string
  needsSheet: boolean
  reasons: PackExportReason[]
}

function exportPackId(
  store: OpenedStore,
  bot: Bot,
  options: PackExportWrite = {},
): { id: string, version: string, author: string, botSlug: string } {
  const author = authorSlug(store)
  let packId = `${author}.${slugifyPackPart(bot.name)}`
  let version = '1.0.0'
  if (bot.installedPackId) {
    try {
      const current = parseInstalledPackSnapshotId(bot.installedPackId)
      packId = current.packId
      version = nextPackVersion(current.version)
    } catch {
      // Fall through and mint from the live Bot.
    }
  }
  if (options.botSlug != null) {
    const botSlug = slugifyPackPart(options.botSlug)
    packId = asPack(() => parsePackId(`${author}.${botSlug}`))
  }
  if (options.version != null) {
    version = asPack(() => parsePackVersion(options.version))
  }
  const parts = packId.split('.')
  return {
    id: packId,
    version,
    author: parts[0] ?? author,
    botSlug: parts[1] ?? slugifyPackPart(bot.name),
  }
}

function installedPackIdsOnCluster(store: OpenedStore): Array<{ botId: string, packId: string }> {
  const rows = store.sqlite.prepare(`
    SELECT 1 AS ok FROM pragma_table_info('bots') WHERE name = 'installed_pack_id'
  `).get() as { ok?: number } | undefined
  if (!rows) {
    return []
  }
  const bots = store.sqlite.prepare(`
    SELECT id, installed_pack_id FROM bots WHERE installed_pack_id IS NOT NULL
  `).all() as Array<{ id: string, installed_pack_id: string }>
  const next: Array<{ botId: string, packId: string }> = []
  for (const row of bots) {
    try {
      next.push({
        botId: row.id,
        packId: parseInstalledPackSnapshotId(row.installed_pack_id).packId,
      })
    } catch {
      // Ignore a bad snapshot ref.
    }
  }
  return next
}

function packIdConflicts(store: OpenedStore, packId: string, exceptBotId: string): boolean {
  return installedPackIdsOnCluster(store).some((row) => (
    row.botId !== exceptBotId && row.packId === packId
  ))
}

export function getInstalledPack(store: OpenedStore, snapshotId: string): PackTree | undefined {
  const row = store.sqlite.prepare(`
    SELECT snapshot_json FROM installed_packs WHERE id = ?
  `).get(snapshotId) as { snapshot_json: string } | undefined
  if (!row) {
    return undefined
  }
  return asPack(() => parsePackTreeJson(JSON.parse(row.snapshot_json) as unknown))
}

export function putInstalledPack(store: OpenedStore, tree: PackTree): string {
  const id = installedPackSnapshotId(tree.manifest.id, tree.manifest.version)
  const existing = store.sqlite.prepare(`
    SELECT snapshot_json FROM installed_packs WHERE id = ?
  `).get(id) as { snapshot_json: string } | undefined
  const snapshot = serializePackTree(tree)
  if (existing) {
    return id
  }
  store.sqlite.prepare(`
    INSERT INTO installed_packs (id, pack_id, version, snapshot_json, installed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, tree.manifest.id, tree.manifest.version, snapshot, Date.now())
  return id
}

export function setBotInstalledPack(store: OpenedStore, botId: string, snapshotId: string): void {
  requireBot(store, botId)
  store.sqlite.prepare(`
    UPDATE bots SET installed_pack_id = ? WHERE id = ?
  `).run(snapshotId, botId)
}

function stampExportedPack(store: OpenedStore, botId: string, tree: PackTree): void {
  const snapshotId = putInstalledPack(store, tree)
  setBotInstalledPack(store, botId, snapshotId)
}

function exportSkills(store: OpenedStore, botId: string) {
  return listBotSkills(store, botId).filter((skill) => !isHostSeedSkillId(skill.id))
}

function applyPackSkills(store: OpenedStore, botId: string, packSkills: PackTree['skills']): void {
  const incoming = packSkills.filter((skill) => !isHostSeedSkillId(skill.id))
  const preserved = listBotSkills(store, botId).filter((skill) => isHostSeedSkillId(skill.id))
  replaceBotSkills(store, botId, [...preserved, ...incoming])
}

function scheduleNameForExport(
  name: string,
  cadence: 'daily' | 'weekly',
  timeLocal: string,
  locale: PackScheduleNameLocale,
): string {
  return name.trim() || inventPackScheduleName(cadence, timeLocal, locale)
}

export function describePackExport(
  store: OpenedStore,
  botId: string,
  viewer?: BotViewer,
): PackExportPreview {
  const bot = requireBot(store, botId)
  if (viewer && !viewerMaySeeBot(store, bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
  const minted = exportPackId(store, bot)
  const installed = bot.installedPackId ? getInstalledPack(store, bot.installedPackId) : undefined
  const reasons: PackExportReason[] = []
  if (packBotSlugNeedsSheet(bot.name) && !bot.installedPackId) {
    reasons.push('empty-slug')
  }
  if (packIdConflicts(store, minted.id, bot.id)) {
    reasons.push('conflict')
  }
  if (bot.installedPackId) {
    reasons.push('re-export')
  }
  return {
    author: minted.author,
    botSlug: minted.botSlug,
    version: minted.version,
    id: minted.id,
    readme: installed?.readme ?? '',
    needsSheet: reasons.length > 0,
    reasons,
  }
}

export function exportBotPack(
  store: OpenedStore,
  botId: string,
  viewer?: BotViewer,
  options: PackExportWrite = {},
): PackTree {
  const bot = requireBot(store, botId)
  if (viewer && !viewerMaySeeBot(store, bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
  const { id, version } = exportPackId(store, bot, options)
  const installed = bot.installedPackId ? getInstalledPack(store, bot.installedPackId) : undefined
  const locale = options.locale === 'ru' ? 'ru' : 'en'
  const readme = options.readme != null
    ? asPack(() => {
        if (typeof options.readme !== 'string') {
          throw new PackInputError('README must be text')
        }
        const trimmed = options.readme.trim()
        if (trimmed.length > PACK_README_MAX) {
          throw new PackInputError(`README must be ${PACK_README_MAX} characters or fewer`)
        }
        return trimmed
      })
    : (installed?.readme ?? '')
  const raw: PackTree = {
    manifest: {
      packFormat: 1,
      engines: { dostigus: `>=${HOST_ENGINE_VERSION}` },
      id,
      version,
      soul: bot.manifest.description,
      suggestedAppearance: {
        name: bot.name,
        label: bot.manifest.label || undefined,
        description: bot.manifest.description || undefined,
        avatarShape: bot.manifest.avatarShape,
        avatarColor: bot.manifest.avatarColor,
      },
      integrations: installed?.manifest.integrations ?? [],
    },
    skills: exportSkills(store, bot.id),
    schedules: listSchedules(store, { botId: bot.id }).map((schedule) => ({
      name: scheduleNameForExport(schedule.name, schedule.cadence, schedule.timeLocal, locale),
      cadence: schedule.cadence,
      timeLocal: schedule.timeLocal,
      daysOfWeek: schedule.daysOfWeek,
      wakeText: schedule.wakeText,
    })),
    uiFiles: installed?.uiFiles ?? [],
    readme,
  }
  const { tree } = scrubPackTree(raw)
  asPack(() => assertNoSecretsInPack(tree))
  stampExportedPack(store, bot.id, tree)
  return tree
}

function assertTargetBot(store: OpenedStore, target: PackApplyTarget, viewer?: BotViewer): Bot | undefined {
  if (target.kind !== 'update') {
    return undefined
  }
  const botId = target.botId?.trim() ?? ''
  if (!botId) {
    throw new StoreError('Name the Bot to update', 400)
  }
  const bot = requireBot(store, botId)
  if (viewer && !viewerMaySeeBot(store, bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
  if (viewer && !canEditBot(bot, viewer)) {
    throw new StoreError('Only the Owner can change this', 403)
  }
  return bot
}

function applyTargetFromBot(store: OpenedStore, target: PackApplyTarget, bot?: Bot): PackApplyTarget {
  return {
    kind: target.kind,
    botId: bot?.id ?? target.botId,
    botName: bot?.name ?? target.botName,
    existingSkillIds: bot ? listBotSkills(store, bot.id).map((skill) => skill.id) : [],
    existingSchedules: bot
      ? listSchedules(store, { botId: bot.id }).map((schedule) => ({
          name: schedule.name,
          cadence: schedule.cadence,
          timeLocal: schedule.timeLocal,
          daysOfWeek: schedule.daysOfWeek,
          installedPackId: schedule.installedPackId,
        }))
      : [],
    previousSnapshotId: bot?.installedPackId ?? null,
  }
}

export function previewPackApply(
  store: OpenedStore,
  tree: PackTree,
  target: PackApplyTarget,
  viewer?: BotViewer,
): PackApplyPlan {
  const bot = assertTargetBot(store, target, viewer)
  return asPack(() => buildApplyPlan(tree, applyTargetFromBot(store, target, bot)))
}

function scheduleSlotKey(row: {
  cadence: 'daily' | 'weekly'
  timeLocal: string
  daysOfWeek: Array<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'> | null
}): string {
  return `${row.cadence}|${row.timeLocal}|${JSON.stringify(row.daysOfWeek ?? [])}`
}

function applySchedules(
  store: OpenedStore,
  botId: string,
  personId: string,
  tree: PackTree,
  snapshotId: string,
  previousSnapshotId: string | null,
): void {
  const existing = listSchedules(store, { botId })
  if (previousSnapshotId) {
    for (const row of existing) {
      if (row.installedPackId === previousSnapshotId) {
        deleteSchedule(store, row.id)
      }
    }
  }
  const remaining = listSchedules(store, { botId })
  const remainingSlots = new Set(remaining.map((row) => scheduleSlotKey(row)))
  for (const template of tree.schedules) {
    const slot = scheduleSlotKey(template)
    if (remainingSlots.has(slot)) {
      continue
    }
    createSchedule(store, {
      botId,
      personId,
      name: template.name,
      cadence: template.cadence,
      timeLocal: template.timeLocal,
      daysOfWeek: template.daysOfWeek,
      wakeText: template.wakeText,
      paused: true,
      installedPackId: snapshotId,
    })
    remainingSlots.add(slot)
  }
}

export function applyPack(
  store: OpenedStore,
  tree: PackTree,
  target: PackApplyTarget,
  viewer?: BotViewer,
): { bot: Bot, plan: PackApplyPlan, greetingPreserved: boolean } {
  const plan = previewPackApply(store, tree, target, viewer)
  if (plan.blockers.length > 0) {
    throw new StoreError(plan.blockers[0] ?? 'Pack Apply is blocked', 400)
  }
  const stamped: PackTree = {
    ...tree,
    source: tree.source ?? { kind: 'file' },
  }
  const snapshotId = putInstalledPack(store, stamped)
  const personId = viewer?.id ?? getClusterOwnerId(store)
  if (!personId) {
    throw new StoreError('Sign in required', 401)
  }

  if (target.kind === 'create') {
    const appearance = tree.manifest.suggestedAppearance
    const mark = randomBotAppearance()
    const created = createBot(store, {
      name: appearance?.name ?? slugifyPackPart(tree.manifest.id.split('.')[1] ?? tree.manifest.id),
      label: appearance?.label,
      description: appearance?.description ?? tree.manifest.soul,
      avatarShape: appearance?.avatarShape ?? mark.avatarShape,
      avatarColor: appearance?.avatarColor ?? mark.avatarColor,
      createdBy: personId,
    })
    applyPackSkills(store, created.bot.id, tree.skills)
    applySchedules(store, created.bot.id, personId, tree, snapshotId, null)
    setBotInstalledPack(store, created.bot.id, snapshotId)
    return {
      bot: requireBot(store, created.bot.id),
      plan: { ...plan, botId: created.bot.id, botName: created.bot.name },
      greetingPreserved: true,
    }
  }

  const bot = assertTargetBot(store, target, viewer)
  if (!bot) {
    throw new StoreError('Name the Bot to update', 400)
  }
  const beforeChat = listMessages(store, bot.id).length
  applyPackSkills(store, bot.id, tree.skills)
  applySchedules(store, bot.id, personId, tree, snapshotId, bot.installedPackId)
  setBotInstalledPack(store, bot.id, snapshotId)
  const after = requireBot(store, bot.id)
  if (listMessages(store, after.id).length !== beforeChat) {
    throw new StoreError('Pack Apply must not wipe Chat', 500)
  }
  return { bot: after, plan, greetingPreserved: true }
}

export function validatePackTree(tree: unknown): PackTree {
  return asPack(() => parsePackTreeJson(tree))
}
