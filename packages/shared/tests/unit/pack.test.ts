import type { PackTree } from '../../src/index'
import { expect, it } from 'vitest'
import {
  assertNoSecretsInPack,
  buildApplyPlan,
  HOST_ENGINE_VERSION,
  hostEngineGate,
  installedPackSnapshotId,
  PACK_FORMAT,
  PackInputError,
  packTreeToZip,
  parsePackManifest,
  parsePackTreeFromFiles,
  parsePackUpload,
  parsePackZip,
  satisfiesEngineRange,
  scrubPackTree,
} from '../../src/index'

function sampleManifest(over: Record<string, unknown> = {}) {
  return {
    packFormat: PACK_FORMAT,
    engines: { dostigus: `>=${HOST_ENGINE_VERSION}` },
    id: 'ada.notes',
    version: '1.0.0',
    soul: 'Keep short notes.',
    ...over,
  }
}

function sampleTree(over: Partial<PackTree> = {}): PackTree {
  return {
    manifest: parsePackManifest(sampleManifest()),
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
    uiFiles: [{ path: 'demo/index.html', content: '<p>Demo</p>' }],
    readme: 'A notes Pack.',
    ...over,
  }
}

it('parses and validates pack.json', () => {
  const manifest = parsePackManifest(sampleManifest({
    suggestedAppearance: { name: 'Notes', avatarShape: 'owl' },
    integrations: [{
      slug: 'openweather',
      reason: 'Morning forecast',
      env: ['OPENWEATHER_API_KEY'],
    }],
  }))
  expect(manifest.id).toBe('ada.notes')
  expect(manifest.version).toBe('1.0.0')
  expect(manifest.suggestedAppearance?.avatarShape).toBe('owl')
  expect(manifest.integrations[0]?.env).toEqual(['OPENWEATHER_API_KEY'])
})

it('rejects a bad Pack id, version, format, and env values', () => {
  expect(() => parsePackManifest(sampleManifest({ id: 'not-an-id' }))).toThrow(PackInputError)
  expect(() => parsePackManifest(sampleManifest({ version: 'v1' }))).toThrow(/semver/)
  expect(() => parsePackManifest(sampleManifest({ packFormat: 0 }))).toThrow(/positive integer/)
  expect(() => parsePackManifest(sampleManifest({
    integrations: [{ slug: 'weather', reason: 'why', env: ['OPENWEATHER_API_KEY=secret'] }],
  }))).toThrow(/names only/)
  expect(() => parsePackManifest(sampleManifest({
    integrations: [{ slug: 'weather', reason: 'why', env: ['KEY'], apiKey: 'sk-secret' }],
  }))).toThrow(/never include values/)
})

it('reads a folder tree including a wrapped root and SKILL.md', () => {
  const tree = parsePackTreeFromFiles({
    'share/pack.json': JSON.stringify(sampleManifest()),
    'share/skills/notes/SKILL.md': '---\ndescription: Keep short notes\n---\n\nWrite everything down.\n',
    'share/schedules/morning.json': JSON.stringify({
      name: 'Morning brief',
      cadence: 'daily',
      timeLocal: '9:00',
      wakeText: 'Summarize the day.',
    }),
    'share/ui/demo/index.html': '<p>Demo</p>',
    'share/README': 'A notes Pack.',
  })
  expect(tree.skills[0]?.id).toBe('notes')
  expect(tree.schedules[0]?.timeLocal).toBe('09:00')
  expect(tree.uiFiles[0]?.path).toBe('demo/index.html')
})

it('scrubs secrets and computer paths so they never land in a zip', () => {
  const dirty = sampleTree({
    manifest: parsePackManifest(sampleManifest({
      soul: 'Key sk-or-v1-preview-fixture and path /home/nick/.ssh/id_rsa',
    })),
    skills: [{
      id: 'notes',
      description: 'Keep short notes',
      instructions: 'Token Bearer supersecrettokenvalue and C:\\Users\\nick\\secrets.txt',
    }],
  })
  const { tree, redacted } = scrubPackTree(dirty)
  expect(redacted.length).toBeGreaterThan(0)
  expect(JSON.stringify(tree)).not.toContain('sk-or-v1-preview-fixture')
  expect(JSON.stringify(tree)).not.toContain('supersecrettokenvalue')
  expect(JSON.stringify(tree)).not.toContain('/home/nick')
  expect(JSON.stringify(tree)).not.toContain('C:\\Users\\nick')
  assertNoSecretsInPack(tree)
  const zip = packTreeToZip(tree)
  const text = new TextDecoder().decode(zip)
  expect(text).not.toContain('sk-or-v1-preview-fixture')
  expect(text).not.toContain('supersecrettokenvalue')
  expect(text).not.toContain('/home/nick')
  const roundTrip = parsePackZip(zip)
  expect(roundTrip.manifest.id).toBe('ada.notes')
  expect(roundTrip.skills[0]?.instructions).toContain('[redacted]')
})

it('builds a preview plan with paused Schedule templates', () => {
  const plan = buildApplyPlan(sampleTree(), {
    kind: 'update',
    botId: 'preview',
    botName: 'New Bot',
    existingSkillIds: ['notes', 'local-only'],
  })
  expect(plan.target).toBe('update')
  expect(plan.chatPreserved).toBe(true)
  expect(plan.snapshotId).toBe(installedPackSnapshotId('ada.notes', '1.0.0'))
  expect(plan.schedules).toEqual([{
    name: 'Morning brief',
    cadence: 'daily',
    timeLocal: '09:00',
    paused: true,
  }])
  expect(plan.skills.find((row) => row.id === 'notes')?.action).toBe('replace')
  expect(plan.skills.find((row) => row.id === 'local-only')?.action).toBe('remove')
  expect(plan.engine.ok).toBe(true)
})

it('warns when Host is outside engines.dostigus and blocks a newer packFormat', () => {
  expect(satisfiesEngineRange(HOST_ENGINE_VERSION, `>=${HOST_ENGINE_VERSION}`)).toBe(true)
  const warn = hostEngineGate('>=99.0.0')
  expect(warn.severity).toBe('warn')
  expect(warn.ok).toBe(false)
  expect(warn.message).toContain('outside engines.dostigus')
  const plan = buildApplyPlan(sampleTree({
    manifest: parsePackManifest(sampleManifest({
      engines: { dostigus: '>=99.0.0' },
      packFormat: 2,
    })),
  }), { kind: 'create' })
  expect(plan.engine.severity).toBe('warn')
  expect(plan.warnings.some((line) => line.includes('outside engines.dostigus'))).toBe(true)
  expect(plan.blockers.some((line) => line.includes('packFormat'))).toBe(true)
  expect(plan.chatPreserved).toBe(false)
})

it('parses a zip upload and a raw pack.json upload', () => {
  const zip = packTreeToZip(sampleTree())
  expect(parsePackUpload({ bytes: zip, filename: 'ada.notes-1.0.0.zip' }).manifest.id).toBe('ada.notes')
  const json = new TextEncoder().encode(JSON.stringify(sampleManifest()))
  expect(parsePackUpload({ bytes: json, filename: 'pack.json' }).skills).toEqual([])
})
