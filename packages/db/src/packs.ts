/**
 * Pack export and Apply. A Pack is not a Bot and not a Module package.
 * See ADR 0039.
 */

import type { Bot, BotViewer, PackApplyPlan, PackApplyTarget, PackTree } from '@dostigus/shared'
import type { OpenedStore } from './store'
import {
  assertNoSecretsInPack,
  buildApplyPlan,
  canEditBot,
  HOST_ENGINE_VERSION,
  installedPackSnapshotId,
  nextPackVersion,
  PackInputError,
  parseInstalledPackSnapshotId,
  parsePackTreeJson,
  randomBotAppearance,
  scrubPackTree,
  serializePackTree,
  slugifyPackPart,
} from '@dostigus/shared'
import { getOwner } from './owners'
import { createBot, getClusterOwnerId, listMessages, requireBot, viewerMaySeeBot } from './queries'
import { createSchedule, listSchedules } from './schedules'
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

function exportPackId(store: OpenedStore, bot: Bot): { id: string, version: string } {
  if (bot.installedPackId) {
    try {
      const current = parseInstalledPackSnapshotId(bot.installedPackId)
      return { id: current.packId, version: nextPackVersion(current.version) }
    } catch {
      // Fall through and mint from the live Bot.
    }
  }
  return {
    id: `${authorSlug(store)}.${slugifyPackPart(bot.name)}`,
    version: '1.0.0',
  }
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

export function exportBotPack(store: OpenedStore, botId: string, viewer?: BotViewer): PackTree {
  const bot = requireBot(store, botId)
  if (viewer && !viewerMaySeeBot(store, bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
  const { id, version } = exportPackId(store, bot)
  const installed = bot.installedPackId ? getInstalledPack(store, bot.installedPackId) : undefined
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
    skills: listBotSkills(store, bot.id),
    schedules: listSchedules(store, { botId: bot.id }).map((schedule) => ({
      name: schedule.name,
      cadence: schedule.cadence,
      timeLocal: schedule.timeLocal,
      daysOfWeek: schedule.daysOfWeek,
      wakeText: schedule.wakeText,
    })),
    uiFiles: installed?.uiFiles ?? [],
    readme: installed?.readme ?? '',
  }
  const { tree } = scrubPackTree(raw)
  asPack(() => assertNoSecretsInPack(tree))
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

export function previewPackApply(
  store: OpenedStore,
  tree: PackTree,
  target: PackApplyTarget,
  viewer?: BotViewer,
): PackApplyPlan {
  const bot = assertTargetBot(store, target, viewer)
  return asPack(() => buildApplyPlan(tree, {
    kind: target.kind,
    botId: bot?.id ?? target.botId,
    botName: bot?.name ?? target.botName,
    existingSkillIds: bot ? listBotSkills(store, bot.id).map((skill) => skill.id) : [],
  }))
}

function applySchedules(
  store: OpenedStore,
  botId: string,
  personId: string,
  tree: PackTree,
): void {
  for (const template of tree.schedules) {
    createSchedule(store, {
      botId,
      personId,
      name: template.name,
      cadence: template.cadence,
      timeLocal: template.timeLocal,
      daysOfWeek: template.daysOfWeek,
      wakeText: template.wakeText,
      paused: true,
    })
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
  const snapshotId = putInstalledPack(store, tree)
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
    replaceBotSkills(store, created.bot.id, tree.skills)
    applySchedules(store, created.bot.id, personId, tree)
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
  replaceBotSkills(store, bot.id, tree.skills)
  applySchedules(store, bot.id, personId, tree)
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
