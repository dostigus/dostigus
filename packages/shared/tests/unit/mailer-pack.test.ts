import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { expect, it } from 'vitest'
import {
  assertNoSecretsInPack,
  buildApplyPlan,
  HOST_ENGINE_VERSION,
  isMailerPackSnapshot,
  MAILER_PACK_ID,
  packTreeToZip,
  parsePackTreeFromFiles,
  parsePackZip,
  satisfiesEngineRange,
  scrubPackTree,
} from '../../src/index'

const root = join(import.meta.dirname, '../../../../packs/dostigus.mailer')

function readTree(dir: string): Record<string, string> {
  const files: Record<string, string> = {}
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      Object.assign(files, readTree(path))
    } else {
      files[relative(root, path)] = readFileSync(path, 'utf8')
    }
  }
  return files
}

it('parses the dostigus.mailer Pack tree for Nick catalog publish', () => {
  const tree = parsePackTreeFromFiles(readTree(root))
  expect(tree.manifest.id).toBe(MAILER_PACK_ID)
  expect(tree.manifest.id).not.toBe('dostigus.mail')
  expect(satisfiesEngineRange(HOST_ENGINE_VERSION, tree.manifest.engines.dostigus)).toBe(true)
  expect(satisfiesEngineRange('0.1.0', tree.manifest.engines.dostigus)).toBe(false)
  expect(tree.skills.map((skill) => skill.id)).toEqual(['inbox-triage', 'reply-drafts'])
  expect(tree.schedules).toEqual([expect.objectContaining({ cadence: 'daily', timeLocal: '08:00' })])
  expect(tree.manifest.integrations).toEqual([expect.objectContaining({ slug: 'mailbox' })])
  expect(tree.readme).toContain('mail allowlist')

  assertNoSecretsInPack(tree)
  expect(scrubPackTree(tree).redacted).toEqual([])
  const roundTrip = parsePackZip(packTreeToZip(tree))
  expect(roundTrip.manifest.integrations[0]?.env).toContain('MAIL_IMAP_PASSWORD')

  const plan = buildApplyPlan(tree, { kind: 'create' })
  expect(plan.schedules.every((row) => row.paused)).toBe(true)
  expect(plan.engine.ok).toBe(true)
})

it('names the Mailer installed snapshot and not dostigus.mail', () => {
  expect(isMailerPackSnapshot('dostigus.mailer@1.0.0')).toBe(true)
  expect(isMailerPackSnapshot('dostigus.mail@1.0.0')).toBe(false)
  expect(isMailerPackSnapshot(null)).toBe(false)
})

it('refuses an export that still carries a bound mailbox password', () => {
  const tree = parsePackTreeFromFiles(readTree(root))
  const leaked = {
    ...tree,
    skills: [{ id: 'leak', description: 'Leak', instructions: 'Login is hunter2-app-pass' }],
  }
  expect(() => assertNoSecretsInPack(leaked, ['hunter2-app-pass'])).toThrow('must not include secrets')
  const { tree: clean, redacted } = scrubPackTree(leaked, { literals: ['hunter2-app-pass'] })
  expect(redacted).toEqual(['skills/leak'])
  expect(JSON.stringify(clean)).not.toContain('hunter2-app-pass')
  expect(() => assertNoSecretsInPack(clean, ['hunter2-app-pass'])).not.toThrow()
})
