import { afterEach, expect, it } from 'vitest'
import {
  attachTaskArtifact,
  createOwner,
  createProject,
  createTask,
  createTicket,
  findProjectIdByToken,
  insertArtifactRow,
  issueProjectToken,
  linkRepo,
  listProjects,
  listTasks,
  openStore,
  revokeProjectToken,
  setCommands,
  StoreError,
  transitionTask,
  updateTicket,
} from '../../src/index'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  createOwner(store, { username: 'nick', passwordHash: 'hash:nick' })
  return store
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

const owner = { kind: 'owner' as const }

it('creates a Project, an Architect Bot, and a board of Tasks', () => {
  const store = memoryStore()
  const project = createProject(store, owner, { name: 'Dostigus', slug: 'dostigus' })
  expect(project.slug).toBe('dostigus')
  expect(project.architectMode).toBe('external')
  expect(project.contextProjectId).toBeNull()
  expect(project.architectBotId).toBeTruthy()
  expect(project.status).toBe('active')

  const quick = createTask(store, owner, project.id, { title: 'Rename the button', mode: 'quick' })
  const bug = createTask(store, owner, project.id, { title: 'Blank board', body: 'Steps', mode: 'bug' })
  const feature = createTask(store, owner, project.id, { title: 'Project token', mode: 'feature' })
  expect(quick.grillPolicy).toBe('required')
  expect(bug.grillPolicy).toBe('short')
  expect(feature.grillPolicy).toBe('required')
  expect(feature.status).toBe('new')

  const moved = transitionTask(store, owner, feature.id, 'in_work')
  expect(moved.status).toBe('in_work')
  const titles = listTasks(store, owner, project.id).map((task) => task.title)
  expect(titles).toContain('Rename the button')
  expect(titles).toContain('Blank board')
  expect(titles).toContain('Project token')
})

it('links one repo, stores Commands, and joins an Artifact', () => {
  const store = memoryStore()
  const project = createProject(store, owner, { name: 'Inherit' })
  const linked = linkRepo(store, owner, project.id, {
    fullName: 'dostigus/inherit',
    defaultBranch: 'main',
  })
  expect(linked.repo?.fullName).toBe('dostigus/inherit')
  expect(linked.repo?.commands.check).toBeNull()
  const withCommands = setCommands(store, owner, project.id, {
    setup: 'pnpm install --frozen-lockfile',
    check: 'CI=1 pnpm check',
  })
  expect(withCommands.repo?.commands.setup).toBe('pnpm install --frozen-lockfile')
  expect(withCommands.repo?.commands.check).toBe('CI=1 pnpm check')

  const task = createTask(store, owner, project.id, { title: 'Shot', mode: 'bug' })
  const artifact = insertArtifactRow(store, {
    filename: 'board.png',
    mime: 'image/png',
    byteSize: 12,
    contentHash: 'abc',
    actorPersonId: project.ownerId,
  })
  const attached = attachTaskArtifact(store, owner, task.id, artifact.id)
  expect(attached.attachments.map((item) => item.filename)).toEqual(['board.png'])
})

it('scopes a Project token to one Project and drops it after revoke', () => {
  const store = memoryStore()
  const first = createProject(store, owner, { name: 'Dostigus', slug: 'dostigus' })
  const second = createProject(store, owner, { name: 'Inherit', slug: 'inherit' })
  const issued = issueProjectToken(store, first.id, 'Grok')
  expect(issued.token.startsWith('dp_')).toBe(true)
  expect(findProjectIdByToken(store, issued.token)).toBe(first.id)
  expect(listProjects(store, { kind: 'project', projectId: first.id }).map((item) => item.id)).toEqual([first.id])
  expect(() => createTask(store, { kind: 'project', projectId: first.id }, second.id, {
    title: 'Nope',
    mode: 'quick',
  })).toThrow(StoreError)
  revokeProjectToken(store, first.id, issued.id)
  expect(findProjectIdByToken(store, issued.token)).toBeUndefined()
})

it('cuts Tickets with blockedBy on the same Task', () => {
  const store = memoryStore()
  const project = createProject(store, owner, { name: 'Dostigus', slug: 'dostigus' })
  const task = createTask(store, owner, project.id, { title: 'Board', mode: 'feature' })
  const blocker = createTicket(store, owner, task.id, {
    title: 'Schema',
    brief: 'Tables first',
  })
  expect(blocker.status).toBe('ready')
  const next = createTicket(store, owner, task.id, {
    title: 'UI',
    brief: 'Board',
    blockedBy: [blocker.id],
  })
  expect(next.blockedBy).toEqual([blocker.id])
  const done = updateTicket(store, owner, blocker.id, { status: 'done' })
  expect(done.status).toBe('done')
  expect(() => createTicket(store, owner, task.id, {
    title: 'Bad edge',
    blockedBy: ['missing'],
  })).toThrow(/blockedBy/)
})
