import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createBot,
  createOwner,
  createSchedule,
  getTurn,
  listTurns,
  openStore,
} from '@dostigus/db'
import { afterEach, expect, it } from 'vitest'
import {
  clearChatActivityPhase,
  clearChatActivityPhases,
  readChatActivityPhase,
  setChatActivityPhase,
} from '../../server/utils/chat-activity-phase'
import { invokeChatMcpTool, platformToolSpec } from '../../server/utils/mcp-platform-tools'
import {
  CHAT_MCP_TOOLS,
  CREATOR_MEMBER_CHAT_MCP_TOOLS,
  MEMBER_CHAT_MCP_TOOLS,
  TURN_MCP_TOOLS,
} from '../../server/utils/mcp-surface'
import { flushScheduleWakes, runScheduleTick } from '../../server/utils/schedule-ticker'
import {
  beginChatTurn,
  recordChatTurnTool,
  requestAborted,
  resetChatTurnJournal,
  settleChatTurn,
  settleFromReply,
  TurnToolError,
} from '../../server/utils/turn-journal'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

afterEach(async () => {
  clearChatActivityPhases()
  await flushScheduleWakes()
  resetChatTurnJournal()
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('dual-writes Activity phases and tool names, and the poll stays in memory', () => {
  const store = memoryStore()
  const bot = createBot(store, { name: 'Notes' }).bot
  const threadId = `bt:${bot.id}:person`
  const turnId = beginChatTurn(store, {
    threadId,
    botId: bot.id,
    personId: 'person',
    trigger: 'user',
  })
  setChatActivityPhase(threadId, bot.id, 'thinking')
  setChatActivityPhase(threadId, bot.id, 'tool')
  recordChatTurnTool(threadId, bot.id, { name: 'dostigus_schedules_list', ok: true, ms: 8 })
  expect(readChatActivityPhase(threadId, bot.id)).toBe('tool')

  settleChatTurn(store, turnId, settleFromReply({ via: 'llm+tools' }))
  clearChatActivityPhase(threadId, bot.id)
  setChatActivityPhase(threadId, bot.id, 'typing')

  expect(readChatActivityPhase(threadId, bot.id)).toBe('typing')
  const turn = getTurn(store, turnId)
  expect(turn?.outcome).toBe('ok')
  expect(turn?.endedAt).not.toBeNull()
  expect(turn?.phases.map((phase) => phase.phase)).toEqual(['thinking', 'tool'])
  expect(turn?.tools).toEqual([{ name: 'dostigus_schedules_list', ok: true, ms: 8 }])
  expect(turn?.scheduleId).toBeNull()
})

it('stores llm_error, tool_error, and aborted without the thrown text', () => {
  const store = memoryStore()
  const bot = createBot(store, { name: 'Notes' }).bot
  const threadId = 'thread-1'
  const llm = beginChatTurn(store, {
    threadId,
    botId: bot.id,
    personId: 'person',
    trigger: 'user',
  })
  settleChatTurn(store, llm, settleFromReply({
    error: new Error('gateway body sk-secret'),
  }))
  expect(getTurn(store, llm)).toMatchObject({ outcome: 'error', errorCode: 'llm_error' })

  const tool = beginChatTurn(store, {
    threadId,
    botId: bot.id,
    personId: 'person',
    trigger: 'mention',
  })
  settleChatTurn(store, tool, settleFromReply({ error: new TurnToolError() }))
  expect(getTurn(store, tool)).toMatchObject({
    outcome: 'error',
    errorCode: 'tool_error',
    trigger: 'mention',
  })

  const aborted = beginChatTurn(store, {
    threadId,
    botId: bot.id,
    personId: 'person',
    trigger: 'user',
  })
  settleChatTurn(store, aborted, settleFromReply({
    via: 'llm',
    aborted: requestAborted({ node: { req: { aborted: true } } }),
  }))
  expect(getTurn(store, aborted)).toMatchObject({ outcome: 'abort', errorCode: 'aborted' })

  const raw = store.sqlite.prepare(`SELECT error_code FROM turns`).all()
  expect(JSON.stringify(raw)).not.toContain('sk-secret')
})

it('sets scheduleId on a Wake turn', async () => {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const bot = createBot(store, { name: 'Notes', createdBy: owner.id }).bot
  const now = Date.parse('2026-01-15T08:00:00.000Z')
  const schedule = createSchedule(store, {
    botId: bot.id,
    personId: owner.id,
    cadence: 'daily',
    timeLocal: '08:00',
    wakeText: 'Morning briefing',
  }, { now, env: {} })
  store.sqlite.prepare('UPDATE schedules SET next_run_at = ? WHERE id = ?').run(now - 1_000, schedule.id)

  runScheduleTick({ store, now, env: {} })
  await flushScheduleWakes()

  const turns = listTurns(store, { botId: bot.id })
  expect(turns).toHaveLength(1)
  expect(turns[0]).toMatchObject({
    trigger: 'wake',
    outcome: 'ok',
    scheduleId: schedule.id,
    personId: owner.id,
    errorCode: null,
    tools: [],
  })
  expect(turns[0]?.phases.map((phase) => phase.phase)).toEqual(['thinking'])
})

it('keeps Turn journal tools off the Chat LLM allowlist and readable from MCP handlers', () => {
  for (const name of TURN_MCP_TOOLS) {
    expect(CHAT_MCP_TOOLS).not.toContain(name)
    expect(MEMBER_CHAT_MCP_TOOLS).not.toContain(name)
    expect(CREATOR_MEMBER_CHAT_MCP_TOOLS).not.toContain(name)
  }

  const store = memoryStore()
  const bot = createBot(store, { name: 'Notes' }).bot
  const turnId = beginChatTurn(store, {
    threadId: 'thread-1',
    botId: bot.id,
    personId: 'person',
    trigger: 'user',
  })
  settleChatTurn(store, turnId, { outcome: 'ok' })

  for (const name of TURN_MCP_TOOLS) {
    expect(invokeChatMcpTool({ name, args: { id: turnId }, store, role: 'owner' }).ok).toBe(false)
    expect(invokeChatMcpTool({ name, args: {}, store, role: 'member' }).ok).toBe(false)
  }
  expect(listTurns(store)).toHaveLength(1)

  const listed = platformToolSpec('dostigus_turns_list').run({ botId: bot.id }, store)
  expect(listed).toEqual({ turns: [expect.objectContaining({ id: turnId, botId: bot.id })] })
  const got = platformToolSpec('dostigus_turns_get').run({ id: turnId }, store)
  expect(got).toEqual({ turn: expect.objectContaining({ id: turnId }) })
  expect(() => platformToolSpec('dostigus_turns_get').run({ id: 'missing' }, store)).toThrow(/Turn not found/)

  const before = listTurns(store).length
  platformToolSpec('dostigus_bots_list').run({}, store)
  expect(listTurns(store)).toHaveLength(before)
})

it('starts a turn only for a Bot reply, including a room mention', () => {
  const botRoute = readFileSync(join(import.meta.dirname, '../../server/api/bots/[id]/messages.post.ts'), 'utf8')
  expect(botRoute).toContain('trigger: \'user\'')
  expect(botRoute.indexOf('beginChatTurn(store')).toBeGreaterThan(botRoute.indexOf('appendClusterMessage'))

  const roomRoute = readFileSync(join(import.meta.dirname, '../../server/api/threads/[id]/messages.post.ts'), 'utf8')
  expect(roomRoute).toContain('trigger: \'mention\'')
  expect(roomRoute.indexOf('mentionedRoomBot(')).toBeLessThan(roomRoute.indexOf('beginChatTurn(store'))
  expect(roomRoute.indexOf('if (!mentioned)')).toBeLessThan(roomRoute.indexOf('beginChatTurn(store'))

  const ticker = readFileSync(join(import.meta.dirname, '../../server/utils/schedule-ticker.ts'), 'utf8')
  expect(ticker).toContain('trigger: \'wake\'')
  expect(ticker).toContain('scheduleId: input.scheduleId')

  const listTool = readFileSync(join(import.meta.dirname, '../../server/mcp/tools/dostigus_turns_list.ts'), 'utf8')
  const getTool = readFileSync(join(import.meta.dirname, '../../server/mcp/tools/dostigus_turns_get.ts'), 'utf8')
  expect(listTool).not.toContain('beginChatTurn')
  expect(getTool).not.toContain('beginChatTurn')
})
