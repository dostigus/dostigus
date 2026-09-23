import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { STORE_MIGRATIONS } from '../../src/migrations'

const migrationsDir = join(import.meta.dirname, '../../migrations')

interface JournalEntry {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

function journalEntries(raw: string): JournalEntry[] {
  const parsed: unknown = JSON.parse(raw)
  if (
    typeof parsed !== 'object'
    || parsed === null
    || !('entries' in parsed)
    || !Array.isArray(parsed.entries)
  ) {
    throw new Error('_journal.json has no entries array')
  }

  return parsed.entries.map((entry: unknown, index) => {
    if (
      typeof entry !== 'object'
      || entry === null
      || !('idx' in entry)
      || !('version' in entry)
      || !('when' in entry)
      || !('tag' in entry)
      || !('breakpoints' in entry)
      || typeof entry.idx !== 'number'
      || typeof entry.version !== 'string'
      || typeof entry.when !== 'number'
      || typeof entry.tag !== 'string'
      || typeof entry.breakpoints !== 'boolean'
    ) {
      throw new Error(`_journal.json entry ${index} is not a journal row`)
    }
    return {
      idx: entry.idx,
      version: entry.version,
      when: entry.when,
      tag: entry.tag,
      breakpoints: entry.breakpoints,
    }
  })
}

it('keeps journal tags, SQL filenames, and STORE_MIGRATIONS ids in lockstep', () => {
  const entries = journalEntries(readFileSync(join(migrationsDir, 'meta/_journal.json'), 'utf8'))
  const sqlFiles = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
  const ids = STORE_MIGRATIONS.map((migration) => migration.id)

  expect(entries.map((entry) => entry.tag)).toEqual(ids)
  expect(sqlFiles).toEqual(ids.map((id) => `${id}.sql`))

  entries.forEach((entry, index) => {
    expect(entry.idx).toBe(index)
    expect(entry.version).toBe('6')
    expect(entry.breakpoints).toBe(true)
    const previous = entries[index - 1]
    if (previous) {
      expect(entry.when).toBeGreaterThan(previous.when)
    }
  })
})
