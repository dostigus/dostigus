import type { Skill } from '@dostigus/shared'
import type { OpenedStore } from './store'
import { parseSkillDescription, parseSkillId, parseSkillInstructions, SkillInputError } from '@dostigus/shared'
import { skillsFromJson } from './map'
import { requireBot } from './queries'
import { StoreError } from './store-error'

/**
 * Skill text lives in `bots.skills_json` as
 * `{ id, description, instructions }` objects.
 * No new column. Legacy id strings and objects without description still
 * read. See ADR 0028 and ADR 0032.
 */

function asSkillInput<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    if (error instanceof SkillInputError) {
      throw new StoreError(error.message, 400)
    }
    throw error
  }
}

function readSkills(store: OpenedStore, botId: string): Skill[] {
  requireBot(store, botId)
  const row = store.sqlite.prepare(
    'SELECT skills_json FROM bots WHERE id = ?',
  ).get(botId) as { skills_json: string }
  return skillsFromJson(row.skills_json)
}

function writeSkills(store: OpenedStore, botId: string, skills: Skill[]): void {
  store.sqlite.prepare(
    'UPDATE bots SET skills_json = ? WHERE id = ?',
  ).run(JSON.stringify(skills), botId)
}

export function listBotSkills(store: OpenedStore, botId: string): Skill[] {
  return readSkills(store, botId)
}

export function getBotSkill(
  store: OpenedStore,
  botId: string,
  skillId: unknown,
): Skill {
  const id = asSkillInput(() => parseSkillId(skillId))
  const skill = readSkills(store, botId).find((row) => row.id === id)
  if (!skill) {
    throw new StoreError('Skill not found', 404)
  }
  return skill
}

/** Same id replaces description and instructions. A new id is appended. */
export function upsertBotSkill(
  store: OpenedStore,
  botId: string,
  input: { id: unknown, description: unknown, instructions: unknown },
): Skill[] {
  const id = asSkillInput(() => parseSkillId(input.id))
  const description = asSkillInput(() => parseSkillDescription(input.description))
  const instructions = asSkillInput(() => parseSkillInstructions(input.instructions))
  const skills = readSkills(store, botId)
  const next: Skill = { id, description, instructions }
  const index = skills.findIndex((skill) => skill.id === id)
  if (index >= 0) {
    skills[index] = next
  } else {
    skills.push(next)
  }
  writeSkills(store, botId, skills)
  return skills
}

export function deleteBotSkill(
  store: OpenedStore,
  botId: string,
  skillId: unknown,
): Skill[] {
  const id = asSkillInput(() => parseSkillId(skillId))
  const skills = readSkills(store, botId)
  const next = skills.filter((skill) => skill.id !== id)
  if (next.length === skills.length) {
    throw new StoreError('Skill not found', 404)
  }
  writeSkills(store, botId, next)
  return next
}
