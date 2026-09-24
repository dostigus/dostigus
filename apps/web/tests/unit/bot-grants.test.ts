import { createMember, createOwner, openStore } from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import {
  createClusterBot,
  deleteClusterBot,
  grantClusterBot,
  listClusterBots,
  listClusterMessages,
  revokeClusterBotGrant,
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
  const other = createMember(store, {
    displayName: 'Lin',
    username: 'lin',
    passwordHash: 'hash:lin',
  })
  return { store, owner, member, other }
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('keeps a new Bot personal and shares it only by grant', () => {
  const { store, owner, member, other } = memoryStore()
  const ownerView = { id: owner.id, role: 'owner' as const }
  const memberView = { id: member.id, role: 'member' as const }
  const otherView = { id: other.id, role: 'member' as const }

  const ownerBot = createClusterBot(store, { name: 'House' }, ownerView)
  expect(ownerBot.bot.createdBy).toBe(owner.id)
  const memberBot = createClusterBot(store, { name: 'Shelf' }, memberView)
  expect(memberBot.bot.createdBy).toBe(member.id)

  expect(listClusterBots(store, ownerView).bots.map((bot) => bot.id).sort())
    .toEqual([ownerBot.bot.id, memberBot.bot.id].sort())
  expect(listClusterBots(store, memberView).bots.map((bot) => bot.id)).toEqual([memberBot.bot.id])
  expect(listClusterBots(store, otherView).bots).toEqual([])

  expect(() => updateClusterBot(store, ownerBot.bot.id, { name: 'Taken' }, memberView))
    .toThrow(/Bot not found/)
  expect(() => updateClusterBot(store, ownerBot.bot.id, { name: 'Taken' }, otherView))
    .toThrow(/Bot not found/)

  const edited = updateClusterBot(store, memberBot.bot.id, { name: 'My shelf' }, memberView)
  expect(edited.bot.name).toBe('My shelf')
  expect(grantClusterBot(store, memberBot.bot.id, { personId: other.id }, memberView).grants
    .map((grant) => grant.personId)).toEqual([other.id])
  expect(listClusterBots(store, otherView).bots.map((bot) => bot.id)).toEqual([memberBot.bot.id])
  expect(() => grantClusterBot(store, memberBot.bot.id, { personId: owner.id }, otherView))
    .toThrow(/cannot share/)
  expect(updateClusterBot(store, memberBot.bot.id, { name: 'Owner edit' }, ownerView).bot.name)
    .toBe('Owner edit')
  expect(deleteClusterBot(store, memberBot.bot.id, ownerView)).toEqual({ ok: true })

  const shared = grantClusterBot(store, ownerBot.bot.id, { personId: member.id }, ownerView)
  expect(shared.grants.map((grant) => grant.personId)).toEqual([member.id])
  expect(listClusterBots(store, memberView).bots.map((bot) => bot.id)).toEqual([ownerBot.bot.id])

  const ownerLines = listClusterMessages(store, ownerBot.bot.id, ownerView).messages
  const memberLines = listClusterMessages(store, ownerBot.bot.id, memberView).messages
  expect(memberLines).toHaveLength(1)
  expect(memberLines[0]?.role).toBe('assistant')
  expect(memberLines[0]?.id).not.toBe(ownerLines[0]?.id)

  expect(() => grantClusterBot(store, ownerBot.bot.id, { personId: other.id }, memberView))
    .toThrow(/cannot share/)
  expect(() => updateClusterBot(store, ownerBot.bot.id, { name: 'Nope' }, memberView))
    .toThrow(/Only the Owner/)

  grantClusterBot(store, ownerBot.bot.id, { allCurrentMembers: true }, ownerView)
  expect(listClusterBots(store, otherView).bots.map((bot) => bot.id)).toEqual([ownerBot.bot.id])

  const later = createMember(store, {
    displayName: 'Kai',
    username: 'kai',
    passwordHash: 'hash:kai',
  })
  expect(listClusterBots(store, { id: later.id, role: 'member' }).bots).toEqual([])

  revokeClusterBotGrant(store, ownerBot.bot.id, member.id, ownerView)
  expect(listClusterBots(store, memberView).bots).toEqual([])
  expect(() => listClusterMessages(store, ownerBot.bot.id, memberView)).toThrow(/Bot not found/)
})
