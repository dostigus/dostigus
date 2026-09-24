import type { Skill } from '@dostigus/shared'
import type { OpenedStore } from './store'
import { parseSkillId, parseSkillInstructions, SkillInputError } from '@dostigus/shared'
import { skillsFromJson } from './map'
import { requireBot, StoreError } from './queries'

/**
 * Skill text lives in `bots.skills_json` as `{ id, instructions }` objects.
 * No new column. Legacy id strings still read. See ADR 0028.
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

/** Same id replaces instructions. A new id is appended. The id is not regenerated. */
export function upsertBotSkill(
  store: OpenedStore,
  botId: string,
  input: { id: unknown, instructions: unknown },
): Skill[] {
  const id = asSkillInput(() => parseSkillId(input.id))
  const instructions = asSkillInput(() => parseSkillInstructions(input.instructions))
  const skills = readSkills(store, botId)
  const index = skills.findIndex((skill) => skill.id === id)
  if (index >= 0) {
    skills[index] = { id, instructions }
  } else {
    skills.push({ id, instructions })
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
