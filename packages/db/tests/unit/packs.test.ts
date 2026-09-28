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
  describePackExport,
  exportBotPack,
  getBot,
  insertMessage,
  listBotSkills,
  listMessages,
  listSchedules,
  META_SKILL_IDS,
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

it('mints a transliterated Pack id from a RU Bot name', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'Nick', passwordHash: 'hash:nick' })
  const { bot } = createBot(store, { name: 'Дождевик', createdBy: owner.id })
  const preview = describePackExport(store, bot.id, { id: owner.id, role: 'owner' })
  expect(preview.id).toBe('nick.dozhdevik')
  expect(preview.needsSheet).toBe(false)
  const exported = exportBotPack(store, bot.id, { id: owner.id, role: 'owner' })
  expect(exported.manifest.id).toBe('nick.dozhdevik')
  expect(exported.manifest.version).toBe('1.0.0')
  expect(exported.manifest.suggestedAppearance?.name).toBe('Дождевик')
})

it('fills an empty Schedule name from cadence and time', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'nick', passwordHash: 'hash:nick' })
  const { bot } = createBot(store, { name: 'Rain', createdBy: owner.id })
  createSchedule(store, {
    botId: bot.id,
    personId: owner.id,
    name: '',
    cadence: 'daily',
    timeLocal: '08:00',
    wakeText: 'Check the weather.',
  })
  const en = exportBotPack(store, bot.id, { id: owner.id, role: 'owner' }, { locale: 'en' })
  expect(en.schedules[0]?.name).toBe('Daily 08:00')
  const ruBot = createBot(store, { name: 'Rain two', createdBy: owner.id }).bot
  createSchedule(store, {
    botId: ruBot.id,
    personId: owner.id,
    name: '   ',
    cadence: 'daily',
    timeLocal: '08:00',
    wakeText: 'Check the weather.',
  })
  const ru = exportBotPack(store, ruBot.id, { id: owner.id, role: 'owner' }, { locale: 'ru' })
  expect(ru.schedules[0]?.name).toBe('Ежедневно 08:00')
})

it('omits Host seed Skills from Export', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'nick', passwordHash: 'hash:nick' })
  const { bot } = createBot(store, { name: 'Weather', createdBy: owner.id })
  upsertBotSkill(store, bot.id, {
    id: 'wake-weather',
    description: 'Morning weather',
    instructions: 'Call dostigus_http_get.',
  })
  const exported = exportBotPack(store, bot.id, { id: owner.id, role: 'owner' })
  expect(exported.skills.map((skill) => skill.id)).toEqual(['wake-weather'])
  expect(exported.skills.some((skill) => skill.id.startsWith('platform-meta-'))).toBe(false)
  for (const id of META_SKILL_IDS) {
    expect(exported.skills.some((skill) => skill.id === id)).toBe(false)
  }
})

it('opens the Export Sheet for an empty Bot-part slug or a Pack id conflict', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'nick', passwordHash: 'hash:nick' })
  const viewer = { id: owner.id, role: 'owner' as const }
  const marks = createBot(store, { name: '!!!', createdBy: owner.id }).bot
  const empty = describePackExport(store, marks.id, viewer)
  expect(empty.needsSheet).toBe(true)
  expect(empty.reasons).toContain('empty-slug')
  expect(empty.botSlug).toBe('pack')
  const notes = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  exportBotPack(store, notes.id, viewer)
  const other = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const conflict = describePackExport(store, other.id, viewer)
  expect(conflict.needsSheet).toBe(true)
  expect(conflict.reasons).toContain('conflict')
  expect(conflict.id).toBe('nick.notes')
})

it('stamps installed_pack on Export and bumps version on the next Export', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'nick', passwordHash: 'hash:nick' })
  const { bot } = createBot(store, { name: 'Дождевик', createdBy: owner.id })
  const first = exportBotPack(store, bot.id, { id: owner.id, role: 'owner' })
  expect(first.manifest.id).toBe('nick.dozhdevik')
  expect(first.manifest.version).toBe('1.0.0')
  expect(getBot(store, bot.id)?.installedPackId).toBe('nick.dozhdevik@1.0.0')
  const second = exportBotPack(store, bot.id, { id: owner.id, role: 'owner' })
  expect(second.manifest.id).toBe('nick.dozhdevik')
  expect(second.manifest.version).toBe('1.0.1')
  expect(getBot(store, bot.id)?.installedPackId).toBe('nick.dozhdevik@1.0.1')
  const preview = describePackExport(store, bot.id, { id: owner.id, role: 'owner' })
  expect(preview.needsSheet).toBe(true)
  expect(preview.reasons).toContain('re-export')
  expect(preview.version).toBe('1.0.2')
})

it('applies onto a new Bot and onto an existing Bot without wiping Chat', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const viewer = { id: owner.id, role: 'owner' as const }
  const pack = tree()
  const created = applyPack(store, pack, { kind: 'create' }, viewer)
  expect(created.bot.name).toBe('Notes')
  expect(created.bot.installedPackId).toBe('ada.notes@1.0.0')
  const createdSkillIds = listBotSkills(store, created.bot.id).map((skill) => skill.id)
  expect(createdSkillIds).toContain('notes')
  for (const id of META_SKILL_IDS) {
    expect(createdSkillIds).toContain(id)
  }
  const createdSchedules = listSchedules(store, { botId: created.bot.id, personId: owner.id })
  expect(createdSchedules).toHaveLength(1)
  expect(createdSchedules[0]?.paused).toBe(true)
  expect(createdSchedules[0]?.name).toBe('Morning brief')
  expect(createdSchedules[0]?.installedPackId).toBe('ada.notes@1.0.0')

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
  expect(plan.skills.some((row) => row.id.startsWith('platform-meta-'))).toBe(false)
  expect(plan.schedules[0]?.paused).toBe(true)
  expect(plan.schedules[0]?.action).toBe('add')

  const updated = applyPack(store, pack, { kind: 'update', botId: existing.id }, viewer)
  expect(updated.bot.id).toBe(existing.id)
  expect(updated.bot.name).toBe('Desk')
  expect(listMessages(store, existing.id).map((line) => line.content)).toEqual(before)
  const skillIds = listBotSkills(store, existing.id).map((skill) => skill.id)
  expect(skillIds).toContain('notes')
  expect(skillIds).not.toContain('local-only')
  for (const id of META_SKILL_IDS) {
    expect(skillIds).toContain(id)
  }
  expect(listSchedules(store, { botId: existing.id, personId: owner.id }).every((row) => row.paused)).toBe(true)
})

it('replaces only provenance-stamped Schedules on Apply update', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const viewer = { id: owner.id, role: 'owner' as const }
  const created = applyPack(store, tree(), { kind: 'create' }, viewer)
  const ownerMade = createSchedule(store, {
    botId: created.bot.id,
    personId: owner.id,
    name: 'Owner ping',
    cadence: 'weekly',
    timeLocal: '18:00',
    daysOfWeek: ['mon'],
    wakeText: 'Owner only.',
  })
  expect(ownerMade.installedPackId).toBeNull()
  const next = tree({
    manifest: parsePackManifest({
      packFormat: PACK_FORMAT,
      engines: { dostigus: `>=${HOST_ENGINE_VERSION}` },
      id: 'ada.notes',
      version: '1.1.0',
      soul: 'Keep short notes.',
    }),
    schedules: [{
      name: 'Evening brief',
      cadence: 'daily',
      timeLocal: '21:00',
      daysOfWeek: null,
      wakeText: 'Wrap the day.',
    }],
  })
  const plan = previewPackApply(store, next, { kind: 'update', botId: created.bot.id }, viewer)
  expect(plan.schedules.find((row) => row.name === 'Evening brief')?.action).toBe('add')
  expect(plan.schedules.find((row) => row.name === 'Morning brief')?.action).toBe('remove')
  applyPack(store, next, { kind: 'update', botId: created.bot.id }, viewer)
  const rows = listSchedules(store, { botId: created.bot.id, personId: owner.id })
  expect(rows.map((row) => row.name).sort()).toEqual(['Evening brief', 'Owner ping'])
  expect(rows.find((row) => row.name === 'Owner ping')?.installedPackId).toBeNull()
  expect(rows.find((row) => row.name === 'Evening brief')?.installedPackId).toBe('ada.notes@1.1.0')
  expect(rows.find((row) => row.name === 'Evening brief')?.paused).toBe(true)
})

it('grandfathers unlabeled Schedules and does not duplicate them on update', () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const viewer = { id: owner.id, role: 'owner' as const }
  const existing = createBot(store, { name: 'Desk', createdBy: owner.id }).bot
  createSchedule(store, {
    botId: existing.id,
    personId: owner.id,
    name: 'Morning brief',
    cadence: 'daily',
    timeLocal: '09:00',
    wakeText: 'Summarize the day.',
  })
  const pack = tree()
  const plan = previewPackApply(store, pack, { kind: 'update', botId: existing.id }, viewer)
  expect(plan.schedules[0]?.action).toBe('keep')
  applyPack(store, pack, { kind: 'update', botId: existing.id }, viewer)
  const rows = listSchedules(store, { botId: existing.id, personId: owner.id })
  expect(rows).toHaveLength(1)
  expect(rows[0]?.name).toBe('Morning brief')
  expect(rows[0]?.installedPackId).toBeNull()
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
