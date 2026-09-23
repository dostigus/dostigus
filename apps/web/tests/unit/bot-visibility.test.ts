import { createMember, createOwner, openStore } from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import {
  createClusterBot,
  deleteClusterBot,
  setClusterBotVisibility,
  updateClusterBot,
} from '../../server/utils/cluster-bots'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, {
    displayName: 'Grace',
    username: 'grace',
    passwordHash: 'hash:grace',
  })
  return { store, owner, member }
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('lets the Owner create a shared Bot and a Member only a private one', () => {
  const { store, owner, member } = memoryStore()
  const ownerBot = createClusterBot(store, { name: 'House' }, { id: owner.id, role: 'owner' })
  expect(ownerBot.bot.visibility).toBe('shared')
  expect(ownerBot.bot.createdBy).toBe(owner.id)

  const memberBot = createClusterBot(store, { name: 'Shelf' }, { id: member.id, role: 'member' })
  expect(memberBot.bot.visibility).toBe('private')
  expect(memberBot.bot.createdBy).toBe(member.id)

  expect(() => createClusterBot(
    store,
    { name: 'Nope', visibility: 'shared' },
    { id: member.id, role: 'member' },
  )).toThrow(/private Bot/)

  expect(() => updateClusterBot(
    store,
    ownerBot.bot.id,
    { name: 'Taken' },
    { id: member.id, role: 'member' },
  )).toThrow(/Only the Owner/)

  const edited = updateClusterBot(
    store,
    memberBot.bot.id,
    { name: 'My shelf' },
    { id: member.id, role: 'member' },
  )
  expect(edited.bot.name).toBe('My shelf')

  expect(() => deleteClusterBot(
    store,
    memberBot.bot.id,
    { id: owner.id, role: 'owner' },
  )).toThrow(/Only the Owner/)

  expect(deleteClusterBot(
    store,
    memberBot.bot.id,
    { id: member.id, role: 'member' },
  )).toEqual({ ok: true })

  const flipped = setClusterBotVisibility(
    store,
    ownerBot.bot.id,
    'private',
    { id: owner.id, role: 'owner' },
  )
  expect(flipped.bot.visibility).toBe('private')
  expect(flipped.bot.createdBy).toBe(owner.id)
  expect(() => setClusterBotVisibility(
    store,
    ownerBot.bot.id,
    'shared',
    { id: member.id, role: 'member' },
  )).toThrow(/Only the Owner/)
})
