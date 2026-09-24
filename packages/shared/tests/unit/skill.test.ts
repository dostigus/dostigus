import { expect, it } from 'vitest'
import { parseSkillId, parseSkillInstructions, SkillInputError } from '../../src/index'

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
