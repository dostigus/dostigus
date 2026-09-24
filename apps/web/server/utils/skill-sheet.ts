import type { OpenedStore } from '@dostigus/db'
import type { BotViewer, Skill } from '@dostigus/shared'
import { StoreError } from '@dostigus/db'
import { deleteClusterSkill, listClusterSkills, upsertClusterSkill } from './cluster-bots'

/**
 * Sheet id `skill`. One Skill on one Bot. Who may write is the creator
 * or the Owner (ADR 0028). A missing Skill says it is gone.
 */

function requireSkill(store: OpenedStore, botId: string, skillId: string, viewer: BotViewer): Skill {
  const { skills } = listClusterSkills(store, botId, viewer)
  const skill = skills.find((item) => item.id === skillId)
  if (!skill) {
    throw new StoreError('This Skill is gone', 404)
  }
  return skill
}

export function skillSheetRead(
  store: OpenedStore,
  botId: string,
  skillId: string,
  viewer: BotViewer,
) {
  return { skill: requireSkill(store, botId, skillId, viewer) }
}

export function skillSheetSave(
  store: OpenedStore,
  botId: string,
  skillId: string,
  input: { id?: string, instructions?: string },
  viewer: BotViewer,
) {
  const current = requireSkill(store, botId, skillId, viewer)
  const id = input.id?.trim() || current.id
  const instructions = input.instructions ?? current.instructions
  const { skills } = upsertClusterSkill(store, botId, { id, instructions }, viewer)
  const saved = skills.find((item) => item.id === id)
  if (!saved) {
    throw new StoreError('Skill not found', 404)
  }
  if (saved.id !== current.id) {
    deleteClusterSkill(store, botId, current.id, viewer)
  }
  return { skill: saved }
}

export function skillSheetDelete(
  store: OpenedStore,
  botId: string,
  skillId: string,
  viewer: BotViewer,
) {
  requireSkill(store, botId, skillId, viewer)
  deleteClusterSkill(store, botId, skillId, viewer)
  return { ok: true as const }
}
