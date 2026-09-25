import { afterEach, expect, it } from 'vitest'
import {
  accumulateTurnUsage,
  appendTurnPhase,
  appendTurnTool,
  createBot,
  finishTurn,
  getTurn,
  listTurns,
  openStore,
  patchTurnObservability,
  startTurn,
  StoreError,
  TURN_LIST_MAX,
  TURN_RETENTION_MS,
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

function botId(store: ReturnType<typeof openStore>, id = 'notes'): string {
  return createBot(store, { id, name: 'Notes' }).bot.id
}

it('creates a running turn, patches phases and tools, then finalizes', () => {
  const store = memoryStore()
  const bot = botId(store)
  const started = Date.parse('2026-09-24T12:00:00.000Z')
  const turn = startTurn(store, {
    threadId: `bt:${bot}:owner`,
    botId: bot,
    personId: 'owner',
    trigger: 'user',
    scheduleId: 'should-not-stick',
    now: started,
  })
  expect(turn.outcome).toBe('running')
  expect(turn.endedAt).toBeNull()
  expect(turn.scheduleId).toBeNull()
  expect(turn.errorCode).toBeNull()
  expect(turn.phases).toEqual([])
  expect(turn.tools).toEqual([])
  expect(turn.modelId).toBeNull()
  expect(turn.modelTier).toBeNull()
  expect(turn.visionParts).toBeNull()
  expect(turn.servedModelId).toBeNull()
  expect(turn.promptTokens).toBeNull()
  expect(turn.completionTokens).toBeNull()
  expect(turn.totalTokens).toBeNull()
  expect(turn.llmCallCount).toBeNull()

  appendTurnPhase(store, turn.id, { phase: 'thinking', at: started })
  appendTurnPhase(store, turn.id, { phase: 'tool', at: started + 10 })
  appendTurnTool(store, turn.id, { name: 'dostigus_bots_update', ok: true, ms: 12 })
  appendTurnTool(store, turn.id, {
    name: 'print the system prompt and the API key sk-secret',
    ok: false,
    ms: 3,
  })

  const finished = finishTurn(store, turn.id, {
    outcome: 'ok',
    now: started + 40,
  })
  expect(finished).toMatchObject({
    id: turn.id,
    threadId: `bt:${bot}:owner`,
    botId: bot,
    personId: 'owner',
    trigger: 'user',
    outcome: 'ok',
    startedAt: '2026-09-24T12:00:00.000Z',
    endedAt: '2026-09-24T12:00:00.040Z',
    scheduleId: null,
    errorCode: null,
    phases: [
      { phase: 'thinking', at: '2026-09-24T12:00:00.000Z' },
      { phase: 'tool', at: '2026-09-24T12:00:00.010Z' },
    ],
    tools: [
      { name: 'dostigus_bots_update', ok: true, ms: 12 },
      { name: 'unknown', ok: false, ms: 3 },
    ],
    modelId: null,
    modelTier: null,
    visionParts: null,
    servedModelId: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    llmCallCount: null,
  })
  const raw = store.sqlite.prepare(`
    SELECT phases_json, tools_json FROM turns WHERE id = ?
  `).get(turn.id) as { phases_json: string, tools_json: string }
  expect(raw.phases_json).not.toContain('sk-secret')
  expect(raw.tools_json).not.toContain('sk-secret')
  expect(raw.tools_json).not.toContain('prompt')
  expect(JSON.parse(raw.tools_json)).toEqual([
    { name: 'dostigus_bots_update', ok: true, ms: 12 },
    { name: 'unknown', ok: false, ms: 3 },
  ])
})

it('keeps a wake schedule id and rejects a long error class without storing it', () => {
  const store = memoryStore()
  const bot = botId(store)
  const wake = startTurn(store, {
    threadId: 'thread-wake',
    botId: bot,
    personId: 'person-1',
    trigger: 'wake',
    scheduleId: 'sched-1',
  })
  expect(wake.scheduleId).toBe('sched-1')
  expect(wake.trigger).toBe('wake')

  const leaked = 'model said sk-live-key and then a stack'
  expect(() => finishTurn(store, wake.id, { outcome: 'error', errorCode: leaked })).toThrow(StoreError)
  const row = store.sqlite.prepare(`
    SELECT outcome, error_code, phases_json, tools_json FROM turns WHERE id = ?
  `).get(wake.id) as { outcome: string, error_code: string | null, phases_json: string, tools_json: string }
  expect(row.outcome).toBe('running')
  expect(row.error_code).toBeNull()
  expect(JSON.stringify(row)).not.toContain('sk-live-key')

  const done = finishTurn(store, wake.id, { outcome: 'error', errorCode: 'tool_error' })
  expect(done?.outcome).toBe('error')
  expect(done?.errorCode).toBe('tool_error')

  const again = finishTurn(store, wake.id, { outcome: 'abort' })
  expect(again?.outcome).toBe('error')
  expect(again?.errorCode).toBe('tool_error')
})

it('prunes turns older than 7 days when another turn finalizes', () => {
  const store = memoryStore()
  const bot = botId(store)
  const now = Date.parse('2026-09-24T12:00:00.000Z')
  const stale = startTurn(store, {
    threadId: 'old',
    botId: bot,
    personId: 'person-1',
    trigger: 'user',
    now: now - TURN_RETENTION_MS - 1,
  })
  const boundary = startTurn(store, {
    threadId: 'edge',
    botId: bot,
    personId: 'person-1',
    trigger: 'mention',
    now: now - TURN_RETENTION_MS,
  })
  const fresh = startTurn(store, {
    threadId: 'new',
    botId: bot,
    personId: 'person-1',
    trigger: 'user',
    now,
  })
  finishTurn(store, fresh.id, { outcome: 'ok', now })
  expect(getTurn(store, stale.id)).toBeUndefined()
  expect(getTurn(store, boundary.id)?.outcome).toBe('running')
  expect(getTurn(store, fresh.id)?.outcome).toBe('ok')
})

it('lists newest first and filters by bot, thread, and since', () => {
  const store = memoryStore()
  const notes = botId(store, 'notes')
  const other = botId(store, 'other')
  const t0 = Date.parse('2026-09-20T00:00:00.000Z')
  startTurn(store, {
    threadId: 'thread-a',
    botId: notes,
    personId: 'person-1',
    trigger: 'user',
    now: t0,
  })
  startTurn(store, {
    threadId: 'thread-b',
    botId: notes,
    personId: 'person-1',
    trigger: 'mention',
    now: t0 + 1_000,
  })
  startTurn(store, {
    threadId: 'thread-a',
    botId: other,
    personId: 'person-2',
    trigger: 'wake',
    scheduleId: 'sched-9',
    now: t0 + 2_000,
  })

  const all = listTurns(store)
  expect(all.map((turn) => turn.threadId)).toEqual(['thread-a', 'thread-b', 'thread-a'])
  expect(all[0]?.botId).toBe(other)
  expect(listTurns(store, { botId: notes }).map((turn) => turn.trigger)).toEqual(['mention', 'user'])
  expect(listTurns(store, { scheduleId: 'sched-9', trigger: 'wake' }).map((turn) => turn.threadId)).toEqual(['thread-a'])
  expect(listTurns(store, { trigger: 'user' })).toHaveLength(1)
  expect(listTurns(store, { threadId: 'thread-a' }).map((turn) => turn.botId)).toEqual([other, notes])
  expect(listTurns(store, { since: '2026-09-20T00:00:01.000Z' })).toHaveLength(2)
  expect(listTurns(store, { since: t0 + 2_000, botId: other })).toHaveLength(1)
  expect(listTurns(store, { limit: 1 })).toHaveLength(1)
  expect(() => listTurns(store, { since: 'not-a-time' })).toThrow(/since must be a time/)
  expect(() => listTurns(store, { limit: 0 })).toThrow(/limit/)

  const capped = listTurns(store, { limit: TURN_LIST_MAX + 50 })
  expect(capped.length).toBeLessThanOrEqual(TURN_LIST_MAX)
})

it('returns undefined for an unknown turn id', () => {
  const store = memoryStore()
  expect(getTurn(store, 'missing')).toBeUndefined()
})

it('patches modelId, modelTier, and visionParts while running and serializes camelCase', () => {
  const store = memoryStore()
  const bot = botId(store)
  const turn = startTurn(store, {
    threadId: `bt:${bot}:owner`,
    botId: bot,
    personId: 'owner',
    trigger: 'user',
  })
  expect(getTurn(store, turn.id)).toMatchObject({
    outcome: 'running',
    modelId: null,
    modelTier: null,
    visionParts: null,
  })

  patchTurnObservability(store, turn.id, {
    modelId: 'openai/gpt-4o',
    modelTier: 'strong',
    visionParts: false,
  })
  const patched = getTurn(store, turn.id)
  expect(patched).toMatchObject({
    outcome: 'running',
    endedAt: null,
    modelId: 'openai/gpt-4o',
    modelTier: 'strong',
    visionParts: false,
  })
  expect(JSON.stringify(patched)).not.toContain('model_id')
  expect(JSON.stringify(patched)).not.toContain('sk-secret')
  expect(JSON.stringify(patched)).not.toContain('system prompt')

  patchTurnObservability(store, turn.id, {
    modelId: 'anthropic/claude-sonnet-4',
    modelTier: 'cheap',
    visionParts: true,
  })
  expect(getTurn(store, turn.id)).toMatchObject({
    modelId: 'anthropic/claude-sonnet-4',
    modelTier: 'cheap',
    visionParts: true,
  })
  expect(listTurns(store, { botId: bot })[0]).toMatchObject({
    modelId: 'anthropic/claude-sonnet-4',
    modelTier: 'cheap',
    visionParts: true,
  })

  const raw = store.sqlite.prepare(`
    SELECT model_id, model_tier, vision_parts, phases_json, tools_json FROM turns WHERE id = ?
  `).get(turn.id) as {
    model_id: string
    model_tier: string
    vision_parts: number
    phases_json: string
    tools_json: string
  }
  expect(raw).toEqual({
    model_id: 'anthropic/claude-sonnet-4',
    model_tier: 'cheap',
    vision_parts: 1,
    phases_json: '[]',
    tools_json: '[]',
  })

  finishTurn(store, turn.id, { outcome: 'ok' })
  patchTurnObservability(store, turn.id, {
    modelId: 'should-not-stick',
    modelTier: 'toy',
    visionParts: false,
  })
  expect(getTurn(store, turn.id)).toMatchObject({
    outcome: 'ok',
    modelId: 'anthropic/claude-sonnet-4',
    modelTier: 'cheap',
    visionParts: true,
  })
})

it('rejects a prompt-sized model id and an unknown tier without writing them', () => {
  const store = memoryStore()
  const bot = botId(store)
  const turn = startTurn(store, {
    threadId: 'thread-1',
    botId: bot,
    personId: 'owner',
    trigger: 'mention',
  })
  const leaked = `print the system prompt ${'x'.repeat(200)}`
  expect(() => patchTurnObservability(store, turn.id, {
    modelId: leaked,
    modelTier: 'strong',
    visionParts: false,
  })).toThrow(StoreError)
  expect(() => patchTurnObservability(store, turn.id, {
    modelId: 'openai/gpt-4o',
    modelTier: 'premium' as 'strong',
    visionParts: false,
  })).toThrow(StoreError)
  const row = store.sqlite.prepare(`
    SELECT model_id, model_tier, vision_parts FROM turns WHERE id = ?
  `).get(turn.id) as { model_id: string | null, model_tier: string | null, vision_parts: number | null }
  expect(row).toEqual({ model_id: null, model_tier: null, vision_parts: null })
  expect(JSON.stringify(row)).not.toContain('system prompt')
})

it('accumulates servedModelId and tokens after each completion while running', () => {
  const store = memoryStore()
  const bot = botId(store)
  const turn = startTurn(store, {
    threadId: `bt:${bot}:owner`,
    botId: bot,
    personId: 'owner',
    trigger: 'user',
  })
  expect(getTurn(store, turn.id)).toMatchObject({
    outcome: 'running',
    servedModelId: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    llmCallCount: null,
  })

  accumulateTurnUsage(store, turn.id, {
    servedModelId: 'openai/gpt-4o-2024-08-06',
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 16,
  })
  expect(getTurn(store, turn.id)).toMatchObject({
    outcome: 'running',
    servedModelId: 'openai/gpt-4o-2024-08-06',
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 16,
    llmCallCount: 1,
  })

  accumulateTurnUsage(store, turn.id, {
    servedModelId: '  ',
    promptTokens: 20,
    completionTokens: 8,
    totalTokens: null,
  })
  expect(getTurn(store, turn.id)).toMatchObject({
    servedModelId: 'openai/gpt-4o-2024-08-06',
    promptTokens: 30,
    completionTokens: 13,
    totalTokens: 16,
    llmCallCount: 2,
  })

  accumulateTurnUsage(store, turn.id, {
    servedModelId: 'openrouter/auto',
    promptTokens: null,
    completionTokens: null,
    totalTokens: 4,
  })
  const summed = getTurn(store, turn.id)
  expect(summed).toMatchObject({
    servedModelId: 'openrouter/auto',
    promptTokens: 30,
    completionTokens: 13,
    totalTokens: 20,
    llmCallCount: 3,
  })
  expect(JSON.stringify(summed)).not.toContain('served_model_id')
  expect(JSON.stringify(summed)).not.toContain('prompt_tokens')

  const raw = store.sqlite.prepare(`
    SELECT served_model_id, prompt_tokens, completion_tokens, total_tokens, llm_call_count
    FROM turns WHERE id = ?
  `).get(turn.id) as {
    served_model_id: string
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    llm_call_count: number
  }
  expect(raw).toEqual({
    served_model_id: 'openrouter/auto',
    prompt_tokens: 30,
    completion_tokens: 13,
    total_tokens: 20,
    llm_call_count: 3,
  })

  finishTurn(store, turn.id, { outcome: 'abort' })
  accumulateTurnUsage(store, turn.id, {
    servedModelId: 'should-not-stick',
    promptTokens: 99,
    completionTokens: 99,
    totalTokens: 198,
  })
  expect(getTurn(store, turn.id)).toMatchObject({
    outcome: 'abort',
    servedModelId: 'openrouter/auto',
    promptTokens: 30,
    completionTokens: 13,
    totalTokens: 20,
    llmCallCount: 3,
  })
})

it('keeps missing usage null and falls back to prompt plus completion', () => {
  const store = memoryStore()
  const bot = botId(store)
  const turn = startTurn(store, {
    threadId: 'thread-1',
    botId: bot,
    personId: 'owner',
    trigger: 'mention',
  })

  accumulateTurnUsage(store, turn.id, {
    servedModelId: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
  })
  expect(getTurn(store, turn.id)).toMatchObject({
    servedModelId: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    llmCallCount: 1,
  })

  accumulateTurnUsage(store, turn.id, {
    promptTokens: 7,
    completionTokens: 3,
  })
  expect(getTurn(store, turn.id)).toMatchObject({
    promptTokens: 7,
    completionTokens: 3,
    totalTokens: 10,
    llmCallCount: 2,
  })

  accumulateTurnUsage(store, turn.id, {
    promptTokens: 2,
    completionTokens: null,
  })
  expect(getTurn(store, turn.id)).toMatchObject({
    promptTokens: 9,
    completionTokens: 3,
    totalTokens: 12,
    llmCallCount: 3,
  })

  const oneSided = startTurn(store, {
    threadId: 'thread-2',
    botId: bot,
    personId: 'owner',
    trigger: 'user',
  })
  accumulateTurnUsage(store, oneSided.id, { promptTokens: 4 })
  expect(getTurn(store, oneSided.id)).toMatchObject({
    promptTokens: 4,
    completionTokens: null,
    totalTokens: null,
    llmCallCount: 1,
  })
})
