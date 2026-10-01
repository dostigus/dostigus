import {
  createBot,
  createMember,
  createMessengerThread,
  createOwner,
  getMessengerThread,
  grantBot,
  listThreadMessages,
  listTurns,
  openStore,
  updateThreadCase,
} from '@dostigus/db'
import { caseFollowUpLine, caseFollowUpWakeText, MEMBER_QUIET_ASSISTANT_REPLY, STUB_ASSISTANT_REPLY } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import { clearChatActivityPhases, setChatActivityPhase } from '../../server/utils/chat-activity-phase'
import { flushScheduleWakes, runScheduleTick } from '../../server/utils/schedule-ticker'
import { resetChatTurnJournal } from '../../server/utils/turn-journal'

const opened: Array<ReturnType<typeof openStore>> = []

afterEach(async () => {
  clearChatActivityPhases()
  await flushScheduleWakes()
  resetChatTurnJournal()
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

const SET_AT = Date.parse('2026-10-01T10:00:00.000Z')
const DUE_AT = Date.parse('2026-10-01T10:05:00.000Z')

function room(input: { label?: string, nextAction?: string } = {}) {
  const store = openStore('file::memory:')
  opened.push(store)
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const grace = createMember(store, { displayName: 'Grace', username: 'grace', passwordHash: 'hash:grace' })
  const expi = createBot(store, { name: 'Expi', createdBy: owner.id }).bot
  grantBot(store, expi.id, grace.id)
  const thread = createMessengerThread(store, {
    kind: 'room',
    title: 'Ops',
    actorId: owner.id,
    personIds: [grace.id],
    botIds: [expi.id],
  })
  updateThreadCase(store, {
    threadId: thread.id,
    actorId: grace.id,
    label: input.label ?? 'Deploy',
    nextAction: input.nextAction ?? 'Check the canary',
    followUpAt: new Date(DUE_AT).toISOString(),
    followUpBotId: expi.id,
  }, { now: SET_AT, env: {} })
  return { store, owner, grace, expi, thread }
}

it('writes the Wake on the room, runs the Bot turn there, and clears the follow-up', async () => {
  const { store, owner, expi, thread } = room()
  runScheduleTick({ store, now: DUE_AT - 1, env: {} })
  await flushScheduleWakes()
  expect(listThreadMessages(store, thread.id)).toHaveLength(0)

  runScheduleTick({ store, now: DUE_AT, env: {} })
  await flushScheduleWakes()
  const lines = listThreadMessages(store, thread.id)
  expect(lines.map((line) => [line.role, line.content, line.botId])).toEqual([
    ['system', 'Deploy', expi.id],
    ['assistant', STUB_ASSISTANT_REPLY, expi.id],
  ])
  expect(getMessengerThread(store, thread.id, owner.id).case).toMatchObject({
    status: 'open',
    followUpAt: null,
    followUpBotId: null,
  })
  const turns = listTurns(store, { threadId: thread.id })
  expect(turns.map((turn) => [turn.trigger, turn.botId, turn.personId, turn.scheduleId])).toEqual([
    ['wake', expi.id, owner.id, null],
  ])

  runScheduleTick({ store, now: DUE_AT + 60_000, env: {} })
  await flushScheduleWakes()
  expect(listThreadMessages(store, thread.id)).toHaveLength(2)
})

it('uses Member quiet-reply copy when the Owner is not on the Thread', async () => {
  const store = openStore('file::memory:')
  opened.push(store)
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const grace = createMember(store, { displayName: 'Grace', username: 'grace', passwordHash: 'hash:grace' })
  const lin = createMember(store, { displayName: 'Lin', username: 'lin', passwordHash: 'hash:lin' })
  const expi = createBot(store, { name: 'Expi', createdBy: owner.id }).bot
  grantBot(store, expi.id, grace.id)
  grantBot(store, expi.id, lin.id)
  const thread = createMessengerThread(store, {
    kind: 'room',
    title: 'Books',
    actorId: grace.id,
    personIds: [lin.id],
    botIds: [expi.id],
  })
  updateThreadCase(store, {
    threadId: thread.id,
    actorId: grace.id,
    label: 'Read',
    followUpAt: new Date(DUE_AT).toISOString(),
    followUpBotId: expi.id,
  }, { now: SET_AT, env: {} })

  runScheduleTick({ store, now: DUE_AT, env: {} })
  await flushScheduleWakes()
  const lines = listThreadMessages(store, thread.id)
  expect(lines.map((line) => [line.role, line.content])).toEqual([
    ['system', 'Read'],
    ['assistant', MEMBER_QUIET_ASSISTANT_REPLY],
  ])
  expect(listTurns(store, { threadId: thread.id }).map((turn) => turn.personId)).toEqual([lin.id])
})

it('waits while that Bot is replying on the Thread', async () => {
  const { store, owner, expi, thread } = room()
  setChatActivityPhase(thread.id, expi.id, 'thinking')
  runScheduleTick({ store, now: DUE_AT, env: {} })
  await flushScheduleWakes()
  expect(listThreadMessages(store, thread.id)).toHaveLength(0)
  expect(getMessengerThread(store, thread.id, owner.id).case?.followUpBotId).toBe(expi.id)

  clearChatActivityPhases()
  runScheduleTick({ store, now: DUE_AT + 30_000, env: {} })
  await flushScheduleWakes()
  expect(listThreadMessages(store, thread.id)).toHaveLength(2)
})

it('skips and clears when the Bot left the room', async () => {
  const { store, owner, thread } = room()
  store.sqlite.prepare(`DELETE FROM thread_participants WHERE thread_id = ? AND kind = 'bot'`).run(thread.id)
  runScheduleTick({ store, now: DUE_AT, env: {} })
  await flushScheduleWakes()
  expect(listThreadMessages(store, thread.id)).toHaveLength(0)
  expect(getMessengerThread(store, thread.id, owner.id).case).toMatchObject({ status: 'open', followUpAt: null })
})

it('names the Wake by label, then Thread title, then Case', () => {
  expect(caseFollowUpLine({ label: 'Deploy', title: 'Ops' })).toBe('Deploy')
  expect(caseFollowUpLine({ label: ' ', title: 'Ops' })).toBe('Ops')
  expect(caseFollowUpLine({ label: '', title: '' })).toBe('Case')
  expect(caseFollowUpWakeText({ label: 'Deploy', nextAction: 'Check the canary' })).toContain('Next action: Check the canary')
  expect(caseFollowUpWakeText({ label: 'Deploy', nextAction: 'Check the canary' })).toContain('Case: Deploy.')
  expect(caseFollowUpWakeText({ label: '', nextAction: '' })).toContain('No next action is written.')
})
