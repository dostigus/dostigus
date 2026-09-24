import { expect, it } from 'vitest'
import {
  parseSkillDescription,
  parseSkillId,
  parseSkillInstructions,
  SKILL_DESCRIPTION_MAX,
  skillCatalogDescription,
  SkillInputError,
} from '../../src/index'

it('keeps a stable Skill id and rejects an empty one', () => {
  expect(parseSkillId('  rain-coat_1 ')).toBe('rain-coat_1')
  expect(() => parseSkillId('')).toThrow(SkillInputError)
  expect(() => parseSkillId('has space')).toThrow(/Skill id/)
})

it('requires Skill instructions and caps the length', () => {
  expect(parseSkillInstructions('  Keep notes.  ')).toBe('Keep notes.')
  expect(() => parseSkillInstructions('   ')).toThrow(/Skill instructions are required/)
  expect(() => parseSkillInstructions('x'.repeat(4_001))).toThrow(/or fewer/)
})

it('requires a Skill description and caps it at 200', () => {
  expect(parseSkillDescription('  Keep short notes.  ')).toBe('Keep short notes.')
  expect(() => parseSkillDescription('')).toThrow(SkillInputError)
  expect(() => parseSkillDescription('   ')).toThrow(/Skill description is required/)
  expect(() => parseSkillDescription('x'.repeat(SKILL_DESCRIPTION_MAX + 1))).toThrow(/200 characters or fewer/)
  expect(skillCatalogDescription({ id: 'notes', description: '' })).toBe('Skill notes')
  expect(skillCatalogDescription({ id: 'notes', description: 'Keep short notes.' })).toBe('Keep short notes.')
})
