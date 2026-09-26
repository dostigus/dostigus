import type { PackTree } from '@dostigus/shared'
import {
  HOST_ENGINE_VERSION,
  PACK_FORMAT,
  packTreeToZip,
  parsePackManifest,
  parsePackZip,
} from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import {
  applyPack,
  createBot,
  createOwner,
  createSchedule,
  exportBotPack,
  insertMessage,
  listBotSkills,
  listMessages,
  listSchedules,
  openStore,
  previewPackApply,
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

function tree(over: Partial<PackTree> = {}): PackTree {
  return {
    manifest: parsePackManifest({
      packFormat: PACK_FORMAT,
      engines: { dostigus: `>=${HOST_ENGINE_VERSION}` },
      id: 'ada.notes',
      version: '1.0.0',
      soul: 'Keep short notes.',
      suggestedAppearance: { name: 'Notes', label: 'Field notes' },
      integrations: [{
        slug: 'openweather',
        reason: 'Morning forecast',
        env: ['OPENWEATHER_API_KEY'],
      }],
    }),
    skills: [{
      id: 'notes',
      description: 'Keep short notes',
      instructions: 'Write everything down.',
    }],
    schedules: [{
      name: 'Morning brief',
      cadence: 'daily',
      timeLocal: '09:00',
      daysOfWeek: null,
      wakeText: 'Summarize the day.',
    }],
    uiFiles: [],
    readme: '',
    ...over,
  }
}

it('exports a scrubbed Pack zip with no secrets and paused Schedule templates in the plan', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'Ada', passwordHash: 'hash:ada' })
  const { bot } = createBot(store, { name: 'Notes', description: 'Key sk-or-v1-preview-fixture', createdBy: owner.id })
  upsertBotSkill(store, bot.id, {
    id: 'notes',
    description: 'Keep short notes',
    instructions: 'Never store Bearer supersecrettokenvalue',
  })
  createSchedule(store, {
    botId: bot.id,
    personId: owner.id,
    name: 'Morning brief',
    cadence: 'daily',
    timeLocal: '09:00',
    wakeText: 'Summarize the day.',
  })
  const exported = exportBotPack(store, bot.id, { id: owner.id, role: 'owner' })
  expect(exported.manifest.id).toBe('ada.notes')
  expect(JSON.stringify(exported)).not.toContain('sk-or-v1-preview-fixture')
  expect(JSON.stringify(exported)).not.toContain('supersecrettokenvalue')
  const zip = packTreeToZip(exported)
  expect(new TextDecoder().decode(zip)).not.toContain('sk-or-v1-preview-fixture')
  expect(parsePackZip(zip).schedules[0]?.wakeText).toBe('Summarize the day.')

  const plan = previewPackApply(store, exported, { kind: 'create' }, { id: owner.id, role: 'owner' })
  expect(plan.target).toBe('create')
  expect(plan.schedules.every((row) => row.paused)).toBe(true)
  expect(plan.unboundIntegrations).toEqual([])
  expect(plan.engine.ok).toBe(true)
})

it('applies onto a new Bot and onto an existing Bot without wiping Chat', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const viewer = { id: owner.id, role: 'owner' as const }
  const pack = tree()
  const created = applyPack(store, pack, { kind: 'create' }, viewer)
  expect(created.bot.name).toBe('Notes')
  expect(created.bot.installedPackId).toBe('ada.notes@1.0.0')
  expect(listBotSkills(store, created.bot.id).map((skill) => skill.id)).toEqual(['notes'])
  const createdSchedules = listSchedules(store, { botId: created.bot.id, personId: owner.id })
  expect(createdSchedules).toHaveLength(1)
  expect(createdSchedules[0]?.paused).toBe(true)
  expect(createdSchedules[0]?.name).toBe('Morning brief')

  const existing = createBot(store, { name: 'Desk', createdBy: owner.id }).bot
  insertMessage(store, { botId: existing.id, role: 'user', content: 'Keep this line', personId: owner.id })
  const before = listMessages(store, existing.id).map((line) => line.content)
  expect(before).toContain('Keep this line')
  upsertBotSkill(store, existing.id, {
    id: 'local-only',
    description: 'Local only',
    instructions: 'A local Skill the Pack does not own.',
  })

  const plan = previewPackApply(store, pack, { kind: 'update', botId: existing.id }, viewer)
  expect(plan.chatPreserved).toBe(true)
  expect(plan.skills.find((row) => row.id === 'local-only')?.action).toBe('remove')
  expect(plan.schedules[0]?.paused).toBe(true)

  const updated = applyPack(store, pack, { kind: 'update', botId: existing.id }, viewer)
  expect(updated.bot.id).toBe(existing.id)
  expect(updated.bot.name).toBe('Desk')
  expect(listMessages(store, existing.id).map((line) => line.content)).toEqual(before)
  expect(listBotSkills(store, existing.id).map((skill) => skill.id)).toEqual(['notes'])
  expect(listSchedules(store, { botId: existing.id, personId: owner.id }).every((row) => row.paused)).toBe(true)
})

it('warns when Host is outside engines.dostigus and refuses a newer packFormat', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const warn = previewPackApply(store, tree({
    manifest: parsePackManifest({
      packFormat: PACK_FORMAT,
      engines: { dostigus: '>=99.0.0' },
      id: 'ada.notes',
      version: '1.0.0',
    }),
  }), { kind: 'create' }, { id: owner.id, role: 'owner' })
  expect(warn.engine.severity).toBe('warn')
  expect(warn.warnings.join('\n')).toMatch(/outside engines\.dostigus/)

  const blocked = previewPackApply(store, tree({
    manifest: parsePackManifest({
      packFormat: 2,
      engines: { dostigus: `>=${HOST_ENGINE_VERSION}` },
      id: 'ada.notes',
      version: '1.0.0',
    }),
  }), { kind: 'create' }, { id: owner.id, role: 'owner' })
  expect(blocked.blockers.join('\n')).toMatch(/packFormat/)
  expect(() => applyPack(store, tree({
    manifest: parsePackManifest({
      packFormat: 2,
      engines: { dostigus: `>=${HOST_ENGINE_VERSION}` },
      id: 'ada.notes',
      version: '1.0.0',
    }),
  }), { kind: 'create' }, { id: owner.id, role: 'owner' })).toThrow(StoreError)
})
