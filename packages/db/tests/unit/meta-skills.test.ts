import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseSkillDescription, parseSkillInstructions, SKILL_INSTRUCTIONS_MAX } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import {
  backfillMetaSkillDescriptions,
  createBot,
  insertMissingHttpGetMetaSkill,
  insertMissingMetaSkills,
  listBotSkills,
  META_SKILL_DESCRIPTIONS,
  META_SKILL_IDS,
  openStore,
  upgradeBotMetaSkills,
  upgradeClusterMetaSkills,
} from '../../src/index'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

function skillsJson(store: ReturnType<typeof openStore>, botId: string): string {
  const row = store.sqlite.prepare(
    'SELECT skills_json FROM bots WHERE id = ?',
  ).get(botId) as { skills_json: string }
  return row.skills_json
}

function writeSkills(store: ReturnType<typeof openStore>, botId: string, skills: unknown): void {
  store.sqlite.prepare(
    'UPDATE bots SET skills_json = ? WHERE id = ?',
  ).run(JSON.stringify(skills), botId)
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('seeds meta Skills on Bot create and stays under the instructions cap', () => {
  const store = memoryStore()
  const { bot } = createBot(store, { name: 'Notes' })
  const skills = listBotSkills(store, bot.id)

  expect(skills.map((skill) => skill.id)).toEqual([...META_SKILL_IDS])
  expect(bot.manifest.skillIds).toEqual([...META_SKILL_IDS])
  for (const skill of skills) {
    expect(skill.instructions.length).toBeLessThanOrEqual(SKILL_INSTRUCTIONS_MAX)
    expect(parseSkillInstructions(skill.instructions)).toBe(skill.instructions)
    expect(parseSkillDescription(skill.description)).toBe(skill.description)
    expect(skill.description).toBe(META_SKILL_DESCRIPTIONS[skill.id as keyof typeof META_SKILL_DESCRIPTIONS])
  }

  const byId = Object.fromEntries(skills.map((skill) => [skill.id, skill.instructions]))
  expect(byId['platform-meta-schedules']).toContain('dostigus_schedules_create')
  expect(byId['platform-meta-schedules']).toContain('dostigus_schedules_list')
  expect(byId['platform-meta-schedules']).toContain('dostigus_schedules_pause')
  expect(byId['platform-meta-schedules']).toContain('dostigus_schedules_update')
  expect(byId['platform-meta-schedules']).toContain('dostigus_schedules_resume')
  expect(byId['platform-meta-schedules']).toContain('dostigus_schedules_delete')
  expect(byId['platform-meta-schedules']).toContain('dostigus_http_get')
  expect(byId['platform-meta-schedules']).toContain('wakeText')
  expect(byId['platform-meta-skills']).toContain('dostigus_skills_list')
  expect(byId['platform-meta-skills']).toContain('dostigus_skills_read')
  expect(byId['platform-meta-skills']).toContain('dostigus_skills_upsert')
  expect(byId['platform-meta-skills']).toContain('dostigus_skills_delete')
  expect(byId['platform-meta-skills']).toContain('{ id, description }[]')
  expect(byId['platform-meta-self-settings']).toContain('dostigus_bots_update')
  expect(byId['platform-meta-marketplace']).toContain('Marketplace')
  expect(byId['platform-meta-marketplace']).toContain('dostigus_http_get')
  expect(byId['platform-meta-marketplace']).toMatch(/Skill про погоду/)
  expect(byId['platform-meta-marketplace']).not.toMatch(/open-meteo|wttr|openweather/i)
  expect(byId['platform-meta-marketplace']).not.toMatch(/dostigus_modules|packages\/modules/)
  expect(byId['platform-meta-http-get']).toContain('dostigus_http_get')
  expect(byId['platform-meta-http-get']).toContain('truncated')
  expect(byId['platform-meta-http-get']).toContain('другим публичным URL')
  expect(byId['platform-meta-http-get']).toContain('не выдумывай факты')
  expect(byId['platform-meta-http-get']).toContain('Host сам другие URL не перебирает')
  expect(byId['platform-meta-http-get']).not.toMatch(/open-meteo|wttr|openweather/i)
  expect(byId['platform-meta-http-get']).not.toMatch(/dostigus_modules|packages\/modules/)
})

it('create insert-if-missing keeps an existing meta Skill and adds only the rest', () => {
  const store = memoryStore()
  const { bot } = createBot(store, { name: 'Notes' })
  const seeded = listBotSkills(store, bot.id)
  const custom = 'Свой текст про Schedule. Не заменять.'
  writeSkills(store, bot.id, [
    { id: 'notes', instructions: 'Keep notes.' },
    { id: 'platform-meta-schedules', instructions: custom },
  ])

  const skills = insertMissingMetaSkills(store, bot.id)
  expect(skills).toEqual([
    { id: 'notes', description: '', instructions: 'Keep notes.' },
    { id: 'platform-meta-schedules', description: '', instructions: custom },
    ...seeded.filter((skill) => skill.id !== 'platform-meta-schedules'),
  ])

  expect(insertMissingMetaSkills(store, bot.id)).toEqual(skills)
  expect(skillsJson(store, bot.id)).toBe(JSON.stringify(skills))
})

it('upgrade inserts the set only when none of the meta Skill ids are stored', () => {
  const store = memoryStore()
  const empty = createBot(store, { name: 'Empty' }).bot
  const partial = createBot(store, { name: 'Partial' }).bot
  const seeded = listBotSkills(store, empty.id)
  writeSkills(store, empty.id, [{ id: 'notes', instructions: 'Keep notes.' }])
  const partialRaw = JSON.stringify([
    { id: 'notes', instructions: 'Keep notes.' },
    { id: 'platform-meta-skills', instructions: 'Уже отредактировано.' },
  ])
  writeSkills(store, partial.id, JSON.parse(partialRaw) as unknown)

  expect(upgradeBotMetaSkills(store, empty.id)).toEqual([
    { id: 'notes', description: '', instructions: 'Keep notes.' },
    ...seeded,
  ])
  expect(upgradeBotMetaSkills(store, partial.id).map((skill) => skill.id)).toEqual([
    'notes',
    'platform-meta-skills',
  ])
  expect(skillsJson(store, partial.id)).toBe(partialRaw)

  upgradeClusterMetaSkills(store)
  expect(listBotSkills(store, partial.id).map((skill) => skill.id)).toEqual([
    'notes',
    'platform-meta-skills',
    'platform-meta-http-get',
  ])
  expect(listBotSkills(store, partial.id).find((skill) => skill.id === 'platform-meta-skills')).toMatchObject({
    description: META_SKILL_DESCRIPTIONS['platform-meta-skills'],
    instructions: 'Уже отредактировано.',
  })
  expect(listBotSkills(store, empty.id).map((skill) => skill.id)).toEqual([
    'notes',
    ...META_SKILL_IDS,
  ])
})

it('host open upgrades a Bot with none of the meta Skill ids and leaves a partial set', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dostigus-meta-skills-'))
  const url = `file:${join(dir, 'cluster.sqlite')}`
  const store = openStore(url)
  opened.push(store)
  const fresh = createBot(store, { name: 'Fresh' }).bot
  const edited = createBot(store, { name: 'Edited' }).bot
  const seeded = listBotSkills(store, fresh.id)
  writeSkills(store, fresh.id, [])
  const editedRaw = JSON.stringify([
    { id: 'platform-meta-marketplace', instructions: 'Оставленный текст.' },
  ])
  writeSkills(store, edited.id, JSON.parse(editedRaw) as unknown)
  store.close()

  const reopened = openStore(url)
  opened.push(reopened)
  expect(listBotSkills(reopened, fresh.id)).toEqual(seeded)
  expect(listBotSkills(reopened, edited.id).map((skill) => skill.id)).toEqual([
    'platform-meta-marketplace',
    'platform-meta-http-get',
  ])
  expect(listBotSkills(reopened, edited.id)[0]).toMatchObject({
    id: 'platform-meta-marketplace',
    description: META_SKILL_DESCRIPTIONS['platform-meta-marketplace'],
    instructions: 'Оставленный текст.',
  })
  rmSync(dir, { recursive: true, force: true })
})

it('keeps StoreError out of the meta-skills and queries cycle', () => {
  const meta = readFileSync(join(import.meta.dirname, '../../src/meta-skills.ts'), 'utf8')
  const queries = readFileSync(join(import.meta.dirname, '../../src/queries.ts'), 'utf8')
  expect(meta).toContain('from \'./store-error\'')
  expect(meta).not.toContain('./queries')
  expect(queries).toContain('from \'./store-error\'')
  expect(queries).toContain('insertMissingMetaSkills')
  expect(queries).not.toContain('class StoreError')
  expect(queries).not.toContain('upsertBotSkill')
})

it('lazy-fills meta descriptions and insert-if-missing http-get on a live Bot', () => {
  const store = memoryStore()
  const { bot } = createBot(store, { name: 'Notes' })
  writeSkills(store, bot.id, [
    { id: 'notes', instructions: 'Keep notes.' },
    { id: 'platform-meta-schedules', instructions: 'Свой текст.' },
    { id: 'platform-meta-skills', description: 'Already set.', instructions: 'Keep.' },
  ])

  expect(insertMissingHttpGetMetaSkill(store, bot.id).map((skill) => skill.id)).toEqual([
    'notes',
    'platform-meta-schedules',
    'platform-meta-skills',
    'platform-meta-http-get',
  ])
  expect(insertMissingHttpGetMetaSkill(store, bot.id).filter((skill) => skill.id === 'platform-meta-http-get')).toHaveLength(1)

  const filled = backfillMetaSkillDescriptions(store, bot.id)
  expect(filled.find((skill) => skill.id === 'platform-meta-schedules')).toMatchObject({
    description: META_SKILL_DESCRIPTIONS['platform-meta-schedules'],
    instructions: 'Свой текст.',
  })
  expect(filled.find((skill) => skill.id === 'platform-meta-skills')).toMatchObject({
    description: 'Already set.',
    instructions: 'Keep.',
  })
  expect(filled.find((skill) => skill.id === 'notes')).toMatchObject({
    description: '',
    instructions: 'Keep notes.',
  })
  expect(backfillMetaSkillDescriptions(store, bot.id)).toEqual(filled)
})
