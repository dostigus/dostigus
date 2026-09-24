import type { OpenedStore } from '@dostigus/db'
import type { BotViewer, MessageRole } from '@dostigus/shared'
import {
  artifactIdsJoinedToBot,
  createBot,
  deleteBot,
  deleteBotSkill,
  getBotSkill,
  grantBot,
  grantBotToCurrentMembers,
  insertMessage,
  listBotGrants,
  listBots,
  listBotSkills,
  listBotThreadMessages,
  requireBot,
  revokeBotGrant,
  StoreError,
  updateBot,
  upsertBotSkill,
  viewerMaySeeBot,
} from '@dostigus/db'
import {
  botThreadPersonId,
  canDeleteBot,
  canEditBot,
  canGrantBot,
  skillCatalogDescription,
  skillCatalogEntry,
} from '@dostigus/shared'
import { gcOrphansAfterUnlink } from './artifacts'

export type ClusterBotInput = {
  name?: string
  modelTier?: string
  avatarShape?: string
  avatarColor?: string
  label?: string
  description?: string
}

export function viewerFromUser(user: { id: string, role?: string }): BotViewer {
  return {
    id: user.id,
    role: user.role === 'member' ? 'member' : 'owner',
  }
}

export type ClusterMessageInput = {
  botId: string
  role: MessageRole
  content: string
  personId?: string | null
  /**
   * Assistant Kit parts. The Chat reply path and `dostigus_messages_create`
   * leave this empty. Preview `?kitchen=1` calls this with the Kitchen
   * button. See ADR 0025 and ADR 0026.
   */
  parts?: unknown
  /** The person whose bot-thread this line belongs on. */
  viewer?: BotViewer
  allowEmpty?: boolean
}

function assertVisible(store: OpenedStore, id: string, viewer: BotViewer) {
  const bot = requireBot(store, id)
  if (!viewerMaySeeBot(store, bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
  return bot
}

function assertCanChange(store: OpenedStore, id: string, viewer: BotViewer) {
  const bot = assertVisible(store, id, viewer)
  if (!canEditBot(bot, viewer)) {
    throw new StoreError('Only the Owner can change this', 403)
  }
  return bot
}

function assertCanGrant(store: OpenedStore, id: string, viewer: BotViewer) {
  const bot = assertVisible(store, id, viewer)
  if (!canGrantBot(bot, viewer)) {
    throw new StoreError('You cannot share this Bot', 403)
  }
  return bot
}

export function listClusterBots(store: OpenedStore, viewer?: BotViewer) {
  return { bots: listBots(store, viewer) }
}

export function getClusterBot(store: OpenedStore, id: string, viewer?: BotViewer) {
  const bot = requireBot(store, id)
  if (viewer && !viewerMaySeeBot(store, bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
  return { bot }
}

/** A new Bot is personal to its creator. No household-wide default. */
export function createClusterBot(
  store: OpenedStore,
  input: ClusterBotInput = {},
  viewer?: BotViewer,
) {
  return createBot(store, {
    ...input,
    createdBy: viewer?.id,
  })
}

export function updateClusterBot(
  store: OpenedStore,
  id: string,
  input: ClusterBotInput,
  viewer?: BotViewer,
) {
  if (viewer) {
    assertCanChange(store, id, viewer)
  }
  return { bot: updateBot(store, id, input) }
}

function assertSkillActor(store: OpenedStore, botId: string, viewer?: BotViewer) {
  if (viewer) {
    assertCanChange(store, botId, viewer)
    return
  }
  requireBot(store, botId)
}

function assertSkillReader(store: OpenedStore, botId: string, viewer?: BotViewer) {
  if (viewer) {
    assertVisible(store, botId, viewer)
    return
  }
  requireBot(store, botId)
}

export function listClusterSkills(
  store: OpenedStore,
  botId: string,
  viewer?: BotViewer,
) {
  assertSkillReader(store, botId, viewer)
  return { skills: listBotSkills(store, botId).map(skillCatalogEntry) }
}

export function readClusterSkill(
  store: OpenedStore,
  botId: string,
  skillId: unknown,
  viewer?: BotViewer,
) {
  assertSkillReader(store, botId, viewer)
  const skill = getBotSkill(store, botId, skillId)
  return {
    skill: {
      ...skill,
      description: skillCatalogDescription(skill),
    },
  }
}

export function upsertClusterSkill(
  store: OpenedStore,
  botId: string,
  input: { id: unknown, description: unknown, instructions: unknown },
  viewer?: BotViewer,
) {
  assertSkillActor(store, botId, viewer)
  return { skills: upsertBotSkill(store, botId, input) }
}

export function deleteClusterSkill(
  store: OpenedStore,
  botId: string,
  skillId: unknown,
  viewer?: BotViewer,
) {
  assertSkillActor(store, botId, viewer)
  return { skills: deleteBotSkill(store, botId, skillId) }
}

export function deleteClusterBot(store: OpenedStore, id: string, viewer?: BotViewer) {
  if (viewer) {
    const bot = assertVisible(store, id, viewer)
    if (!canDeleteBot(bot, viewer)) {
      throw new StoreError('Only the Owner can change this', 403)
    }
  }
  const orphanIds = artifactIdsJoinedToBot(store, id)
  deleteBot(store, id)
  gcOrphansAfterUnlink(store, orphanIds)
  return { ok: true as const }
}

export function listClusterBotGrants(store: OpenedStore, id: string, viewer: BotViewer) {
  assertCanGrant(store, id, viewer)
  return { grants: listBotGrants(store, id) }
}

export function grantClusterBot(
  store: OpenedStore,
  id: string,
  input: { personId?: string, personIds?: string[], allCurrentMembers?: boolean },
  viewer: BotViewer,
) {
  assertCanGrant(store, id, viewer)
  if (input.allCurrentMembers) {
    return { grants: grantBotToCurrentMembers(store, id) }
  }
  const ids = [
    ...(input.personIds ?? []),
    ...(input.personId ? [input.personId] : []),
  ].map((personId) => personId.trim()).filter(Boolean)
  if (ids.length === 0) {
    throw new StoreError('Name a Member', 400)
  }
  for (const personId of ids) {
    grantBot(store, id, personId)
  }
  return { grants: listBotGrants(store, id) }
}

export function revokeClusterBotGrant(
  store: OpenedStore,
  id: string,
  personId: string,
  viewer: BotViewer,
) {
  assertCanGrant(store, id, viewer)
  revokeBotGrant(store, id, personId)
  return { ok: true as const }
}

export function listClusterMessages(store: OpenedStore, botId: string, viewer?: BotViewer) {
  const bot = requireBot(store, botId)
  if (viewer && !viewerMaySeeBot(store, bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
  const personId = viewer ? botThreadPersonId(bot, viewer) : null
  return { messages: listBotThreadMessages(store, botId, personId) }
}

export function appendClusterMessage(store: OpenedStore, input: ClusterMessageInput) {
  return insertMessage(store, {
    ...input,
    allowEmpty: input.allowEmpty === true,
  })
}

export function withClusterStore<T>(fn: (store: OpenedStore) => T): T {
  try {
    return fn(useStore())
  } catch (error) {
    throwStoreError(error)
  }
}
