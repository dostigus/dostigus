import { afterEach, expect, it } from 'vitest'
import {
  createBot,
  deleteBotSkill,
  getBotSkill,
  listBotSkills,
  openStore,
  requireBot,
  StoreError,
  upsertBotSkill,
} from '../../src/index'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('stores Skill objects in skills_json and keeps legacy ids', () => {
  const store = memoryStore()
  const { bot } = createBot(store, { name: 'Notes' })
  store.sqlite.prepare('UPDATE bots SET skills_json = ? WHERE id = ?').run(
    JSON.stringify(['notes', 'notes']),
    bot.id,
  )
  expect(requireBot(store, bot.id).manifest.skillIds).toEqual(['notes'])
  expect(listBotSkills(store, bot.id)).toEqual([{ id: 'notes', description: '', instructions: '' }])

  expect(() => upsertBotSkill(store, bot.id, {
    id: 'notes',
    description: '',
    instructions: 'Keep short notes.',
  })).toThrow(/description is required/)

  const upserted = upsertBotSkill(store, bot.id, {
    id: 'notes',
    description: 'Keep short notes.',
    instructions: 'Keep short notes.',
  })
  expect(upserted).toEqual([{
    id: 'notes',
    description: 'Keep short notes.',
    instructions: 'Keep short notes.',
  }])
  expect(requireBot(store, bot.id).manifest.skillIds).toEqual(['notes'])

  const added = upsertBotSkill(store, bot.id, {
    id: ' rain ',
    description: '  Rain notes. ',
    instructions: '  Mention rain. ',
  })
  expect(added.map((skill) => skill.id)).toEqual(['notes', 'rain'])
  const raw = store.sqlite.prepare(
    'SELECT skills_json FROM bots WHERE id = ?',
  ).get(bot.id) as { skills_json: string }
  expect(JSON.parse(raw.skills_json)).toEqual([
    { id: 'notes', description: 'Keep short notes.', instructions: 'Keep short notes.' },
    { id: 'rain', description: 'Rain notes.', instructions: 'Mention rain.' },
  ])

  expect(deleteBotSkill(store, bot.id, 'notes').map((skill) => skill.id)).toEqual(['rain'])
  expect(requireBot(store, bot.id).manifest.skillIds).toEqual(['rain'])
  expect(() => deleteBotSkill(store, bot.id, 'notes')).toThrow(StoreError)
  expect(() => upsertBotSkill(store, bot.id, {
    id: 'rain',
    description: 'Rain',
    instructions: '  ',
  })).toThrow(/instructions are required/)
  expect(getBotSkill(store, bot.id, 'rain')).toEqual({
    id: 'rain',
    description: 'Rain notes.',
    instructions: 'Mention rain.',
  })
  expect(() => getBotSkill(store, bot.id, 'notes')).toThrow(/Skill not found/)
})
