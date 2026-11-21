import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { boardColumns } from '../../app/utils/project-board'

const tasks = [
  { id: 'a', title: 'Rename the button', status: 'new', mode: 'quick' },
  { id: 'b', title: 'Blank board', status: 'new', mode: 'bug' },
  { id: 'c', title: 'Project token', status: 'in_work', mode: 'feature' },
]

it('places three Tasks on the board and keeps every status column', () => {
  const columns = boardColumns(tasks)
  expect(columns.map((column) => column.status)).toEqual([
    'new',
    'grilling',
    'awaiting_approval',
    'in_work',
    'awaiting_acceptance',
    'released',
    'dropped',
  ])
  const fresh = columns.find((column) => column.status === 'new')
  const working = columns.find((column) => column.status === 'in_work')
  const released = columns.find((column) => column.status === 'released')
  expect(fresh?.tasks.map((task) => task.title)).toEqual(['Rename the button', 'Blank board'])
  expect(working?.tasks.map((task) => task.id)).toEqual(['c'])
  expect(released?.tasks).toEqual([])
})

it('renders the board and the Task card with Kit rows', () => {
  const page = readFileSync(
    join(import.meta.dirname, '../../app/pages/dashboard/projects/[id].vue'),
    'utf8',
  )
  expect(page).toContain('boardColumns')
  expect(page).toContain('data-status')
  expect(page).toContain('KitListRow')
  expect(page).toContain('KitPanel')
  expect(page).toContain('ChatMessageArtifacts')
  expect(page).toContain('/bots/')
  expect(page).not.toContain('dostigus_grills_')
})
