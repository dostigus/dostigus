/**
 * Skill id, description, and instructions. The Store and the MCP surface share these.
 * See ADR 0028 and ADR 0032. A Skill is not a Module package.
 */

import type { Skill } from './types'

export const SKILL_ID_MAX = 64
export const SKILL_DESCRIPTION_MAX = 200
export const SKILL_INSTRUCTIONS_MAX = 4_000

const SKILL_ID_PATTERN = /^[\w-]{1,64}$/

export class SkillInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillInputError'
  }
}

/** Stable slug. Upsert keeps this id; it does not mint a new one. */
export function parseSkillId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new SkillInputError('Skill id is required')
  }
  const id = value.trim()
  if (!SKILL_ID_PATTERN.test(id)) {
    throw new SkillInputError(`Skill id must be 1–${SKILL_ID_MAX} letters, digits, _ or -`)
  }
  return id
}

/** Required catalog line. 1–200 characters after trim. */
export function parseSkillDescription(value: unknown): string {
  if (typeof value !== 'string') {
    throw new SkillInputError('Skill description is required')
  }
  const description = value.trim()
  if (!description) {
    throw new SkillInputError('Skill description is required')
  }
  if (description.length > SKILL_DESCRIPTION_MAX) {
    throw new SkillInputError(`Skill description must be ${SKILL_DESCRIPTION_MAX} characters or fewer`)
  }
  return description
}

/** Catalog description, or `Skill {id}` when a legacy row has none. */
export function skillCatalogDescription(skill: Pick<Skill, 'id' | 'description'>): string {
  const description = skill.description.trim()
  return description || `Skill ${skill.id}`
}

export function skillCatalogEntry(skill: Skill): { id: string, description: string } {
  return { id: skill.id, description: skillCatalogDescription(skill) }
}

/** Non-empty instructions. Internal newlines stay. */
export function parseSkillInstructions(value: unknown): string {
  if (typeof value !== 'string') {
    throw new SkillInputError('Skill instructions are required')
  }
  const instructions = value.trim()
  if (!instructions) {
    throw new SkillInputError('Skill instructions are required')
  }
  if (instructions.length > SKILL_INSTRUCTIONS_MAX) {
    throw new SkillInputError(`Skill instructions must be ${SKILL_INSTRUCTIONS_MAX} characters or fewer`)
  }
  return instructions
}
