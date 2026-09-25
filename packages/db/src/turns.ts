import type { ModelTier } from '@dostigus/shared'
import type { OpenedStore } from './store'
import { randomUUID } from 'node:crypto'
import { isModelTier } from '@dostigus/shared'
import { StoreError } from './store-error'

/** Rows older than this are deleted when a Turn is finalized. See ADR 0029. */
export const TURN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export const TURN_LIST_DEFAULT = 50
export const TURN_LIST_MAX = 100

const PHASE_CAP = 64
const TOOL_CAP = 64
const ID_MAX = 128
const TOOL_NAME = /^[\w.:-]{1,80}$/
const ERROR_CODE = /^[a-z][a-z0-9_]{0,31}$/

const TURN_COLUMNS = `
  id, thread_id, bot_id, person_id, trigger, outcome, started_at, ended_at,
  schedule_id, error_code, phases_json, tools_json, model_id, model_tier, vision_parts,
  served_model_id, prompt_tokens, completion_tokens, total_tokens, llm_call_count
`

export const TURN_TRIGGERS = ['user', 'wake', 'mention'] as const
export type TurnTrigger = typeof TURN_TRIGGERS[number]

export const TURN_OUTCOMES = ['running', 'ok', 'error', 'abort'] as const
export type TurnOutcome = typeof TURN_OUTCOMES[number]

export const TURN_PHASES = ['thinking', 'tool', 'typing'] as const
export type TurnPhaseName = typeof TURN_PHASES[number]

export type TurnPhase = {
  phase: TurnPhaseName
  at: string
}

export type TurnTool = {
  name: string
  ok: boolean
  ms: number
}

export type Turn = {
  id: string
  threadId: string
  botId: string
  personId: string
  trigger: TurnTrigger
  outcome: TurnOutcome
  startedAt: string
  endedAt: string | null
  scheduleId: string | null
  errorCode: string | null
  phases: TurnPhase[]
  tools: TurnTool[]
  modelId: string | null
  modelTier: ModelTier | null
  visionParts: boolean | null
  servedModelId: string | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  llmCallCount: number | null
}

/** Early patch after resolveModelId and the vision needles gate. See ADR 0029. */
export type TurnObservability = {
  modelId: string
  modelTier: ModelTier
  visionParts: boolean
}

/** One LLM completion while the Turn is still running. See ADR 0029. */
export type TurnUsageDelta = {
  servedModelId?: string | null
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
}

export type TurnFinish = {
  outcome: 'ok' | 'error' | 'abort'
  errorCode?: string | null
  now?: number
}

type TurnSqlRow = {
  id: string
  thread_id: string
  bot_id: string
  person_id: string
  trigger: string
  outcome: string
  started_at: number
  ended_at: number | null
  schedule_id: string | null
  error_code: string | null
  phases_json: string
  tools_json: string
  model_id: string | null
  model_tier: string | null
  vision_parts: number | null
  served_model_id: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  llm_call_count: number | null
}

function isTrigger(value: string): value is TurnTrigger {
  return (TURN_TRIGGERS as readonly string[]).includes(value)
}

function isOutcome(value: string): value is TurnOutcome {
  return (TURN_OUTCOMES as readonly string[]).includes(value)
}

function isPhase(value: string): value is TurnPhaseName {
  return (TURN_PHASES as readonly string[]).includes(value)
}

function requireId(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > ID_MAX) {
    throw new StoreError(`${label} is required`, 400)
  }
  return trimmed
}

function optionalId(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length > ID_MAX) {
    throw new StoreError('Schedule id is invalid', 400)
  }
  return trimmed
}

/** Keep a short tool name. Anything else becomes `unknown` so a prompt cannot land in the row. */
export function turnToolName(name: string): string {
  const trimmed = name.trim()
  if (!TOOL_NAME.test(trimmed)) {
    return 'unknown'
  }
  return trimmed
}

function turnToolMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) {
    return 0
  }
  return Math.min(Math.round(ms), 3_600_000)
}

function assertErrorCode(outcome: TurnFinish['outcome'], code: string | null | undefined): string | null {
  if (outcome === 'ok') {
    if (code) {
      throw new StoreError('An ok Turn has no error code', 400)
    }
    return null
  }
  if (outcome === 'abort') {
    return 'aborted'
  }
  if (code == null || code === '') {
    return null
  }
  if (!ERROR_CODE.test(code)) {
    throw new StoreError('Turn error code must be a short class', 400)
  }
  return code
}

function parsePhases(raw: string): TurnPhase[] {
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) {
      return []
    }
    const phases: TurnPhase[] = []
    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue
      }
      const phase = 'phase' in item && typeof item.phase === 'string' ? item.phase : ''
      const at = 'at' in item && typeof item.at === 'string' ? item.at : ''
      if (!isPhase(phase) || Number.isNaN(Date.parse(at))) {
        continue
      }
      phases.push({ phase, at })
    }
    return phases
  } catch {
    return []
  }
}

function parseTools(raw: string): TurnTool[] {
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) {
      return []
    }
    const tools: TurnTool[] = []
    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue
      }
      const name = 'name' in item && typeof item.name === 'string' ? turnToolName(item.name) : 'unknown'
      const ok = 'ok' in item && item.ok === true
      const ms = 'ms' in item && typeof item.ms === 'number' ? turnToolMs(item.ms) : 0
      tools.push({ name, ok, ms })
    }
    return tools
  } catch {
    return []
  }
}

function toVisionParts(value: number | null): boolean | null {
  if (value == null) {
    return null
  }
  return value !== 0
}

function toModelId(value: string | null): string | null {
  if (value == null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed && trimmed.length <= ID_MAX ? trimmed : null
}

function toTokenCount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(value)) {
    return null
  }
  return value
}

function addTokenCounts(current: number | null, add: number | null): number | null {
  if (add == null) {
    return current
  }
  return (current ?? 0) + add
}

function toDisplayTotalTokens(
  promptTokens: number | null,
  completionTokens: number | null,
  providerTotal: number | null,
): number | null {
  if (providerTotal != null) {
    return providerTotal
  }
  if (promptTokens != null && completionTokens != null) {
    return promptTokens + completionTokens
  }
  return null
}

function toTurn(row: TurnSqlRow): Turn {
  const trigger = isTrigger(row.trigger) ? row.trigger : 'user'
  const outcome = isOutcome(row.outcome) ? row.outcome : 'error'
  return {
    id: row.id,
    threadId: row.thread_id,
    botId: row.bot_id,
    personId: row.person_id,
    trigger,
    outcome,
    startedAt: new Date(row.started_at).toISOString(),
    endedAt: row.ended_at == null ? null : new Date(row.ended_at).toISOString(),
    scheduleId: row.schedule_id,
    errorCode: row.error_code && ERROR_CODE.test(row.error_code) ? row.error_code : null,
    phases: parsePhases(row.phases_json),
    tools: parseTools(row.tools_json),
    modelId: toModelId(row.model_id),
    modelTier: row.model_tier && isModelTier(row.model_tier) ? row.model_tier : null,
    visionParts: toVisionParts(row.vision_parts),
    servedModelId: toModelId(row.served_model_id),
    promptTokens: toTokenCount(row.prompt_tokens),
    completionTokens: toTokenCount(row.completion_tokens),
    totalTokens: toDisplayTotalTokens(
      toTokenCount(row.prompt_tokens),
      toTokenCount(row.completion_tokens),
      toTokenCount(row.total_tokens),
    ),
    llmCallCount: toTokenCount(row.llm_call_count),
  }
}

function selectTurn(store: OpenedStore, id: string): TurnSqlRow | undefined {
  return store.sqlite.prepare(`
    SELECT ${TURN_COLUMNS}
    FROM turns
    WHERE id = ?
  `).get(id) as TurnSqlRow | undefined
}

export function getTurn(store: OpenedStore, id: string): Turn | undefined {
  const trimmed = id.trim()
  if (!trimmed) {
    return undefined
  }
  const row = selectTurn(store, trimmed)
  return row ? toTurn(row) : undefined
}

export function startTurn(
  store: OpenedStore,
  input: {
    threadId: string
    botId: string
    personId: string
    trigger: TurnTrigger
    scheduleId?: string | null
    now?: number
  },
): Turn {
  if (!isTrigger(input.trigger)) {
    throw new StoreError('Turn trigger must be user, wake, or mention', 400)
  }
  const now = input.now ?? Date.now()
  const id = randomUUID()
  const scheduleId = input.trigger === 'wake' ? optionalId(input.scheduleId) : null
  store.sqlite.prepare(`
    INSERT INTO turns (
      id, thread_id, bot_id, person_id, trigger, outcome, started_at, ended_at,
      schedule_id, error_code, phases_json, tools_json
    ) VALUES (?, ?, ?, ?, ?, 'running', ?, NULL, ?, NULL, '[]', '[]')
  `).run(
    id,
    requireId(input.threadId, 'Thread'),
    requireId(input.botId, 'Bot'),
    requireId(input.personId, 'Person'),
    input.trigger,
    now,
    scheduleId,
  )
  const row = selectTurn(store, id)
  if (!row) {
    throw new StoreError('Turn not found', 404)
  }
  return toTurn(row)
}

function withTurn(store: OpenedStore, id: string, run: (row: TurnSqlRow) => void): void {
  const trimmed = id.trim()
  if (!trimmed) {
    throw new StoreError('Turn not found', 404)
  }
  store.sqlite.exec('BEGIN IMMEDIATE')
  try {
    const row = selectTurn(store, trimmed)
    if (!row) {
      throw new StoreError('Turn not found', 404)
    }
    if (row.outcome === 'running') {
      run(row)
    }
    store.sqlite.exec('COMMIT')
  } catch (error) {
    store.sqlite.exec('ROLLBACK')
    throw error
  }
}

export function appendTurnPhase(
  store: OpenedStore,
  id: string,
  input: { phase: TurnPhaseName, at?: number },
): void {
  if (!isPhase(input.phase)) {
    return
  }
  const atMs = input.at ?? Date.now()
  withTurn(store, id, (row) => {
    const phases = parsePhases(row.phases_json)
    if (phases.length >= PHASE_CAP) {
      return
    }
    phases.push({ phase: input.phase, at: new Date(atMs).toISOString() })
    store.sqlite.prepare(`
      UPDATE turns SET phases_json = ? WHERE id = ?
    `).run(JSON.stringify(phases), row.id)
  })
}

export function patchTurnObservability(
  store: OpenedStore,
  id: string,
  input: TurnObservability,
): void {
  const modelId = requireId(input.modelId, 'Model')
  if (!isModelTier(input.modelTier)) {
    throw new StoreError('Turn model tier is invalid', 400)
  }
  if (typeof input.visionParts !== 'boolean') {
    throw new StoreError('Turn visionParts must be a boolean', 400)
  }
  withTurn(store, id, (row) => {
    store.sqlite.prepare(`
      UPDATE turns SET model_id = ?, model_tier = ?, vision_parts = ? WHERE id = ?
    `).run(modelId, input.modelTier, input.visionParts ? 1 : 0, row.id)
  })
}

export function accumulateTurnUsage(
  store: OpenedStore,
  id: string,
  input: TurnUsageDelta,
): void {
  const servedModelId = toModelId(input.servedModelId ?? null)
  const promptTokens = toTokenCount(input.promptTokens)
  const completionTokens = toTokenCount(input.completionTokens)
  const providerTotal = toTokenCount(input.totalTokens)
  withTurn(store, id, (row) => {
    const nextServed = servedModelId ?? toModelId(row.served_model_id)
    const nextPrompt = addTokenCounts(toTokenCount(row.prompt_tokens), promptTokens)
    const nextCompletion = addTokenCounts(toTokenCount(row.completion_tokens), completionTokens)
    const nextProviderTotal = addTokenCounts(toTokenCount(row.total_tokens), providerTotal)
    const nextCount = (toTokenCount(row.llm_call_count) ?? 0) + 1
    store.sqlite.prepare(`
      UPDATE turns
      SET served_model_id = ?, prompt_tokens = ?, completion_tokens = ?,
          total_tokens = ?, llm_call_count = ?
      WHERE id = ?
    `).run(nextServed, nextPrompt, nextCompletion, nextProviderTotal, nextCount, row.id)
  })
}

export function appendTurnTool(
  store: OpenedStore,
  id: string,
  input: { name: string, ok: boolean, ms: number },
): void {
  withTurn(store, id, (row) => {
    const tools = parseTools(row.tools_json)
    if (tools.length >= TOOL_CAP) {
      return
    }
    tools.push({
      name: turnToolName(input.name),
      ok: input.ok === true,
      ms: turnToolMs(input.ms),
    })
    store.sqlite.prepare(`
      UPDATE turns SET tools_json = ? WHERE id = ?
    `).run(JSON.stringify(tools), row.id)
  })
}

export function finishTurn(store: OpenedStore, id: string, input: TurnFinish): Turn | undefined {
  const outcome = input.outcome
  if (outcome !== 'ok' && outcome !== 'error' && outcome !== 'abort') {
    throw new StoreError('Turn outcome must be ok, error, or abort', 400)
  }
  const errorCode = assertErrorCode(outcome, input.errorCode)
  const now = input.now ?? Date.now()
  const trimmed = id.trim()
  if (!trimmed) {
    throw new StoreError('Turn not found', 404)
  }
  store.sqlite.exec('BEGIN IMMEDIATE')
  try {
    const row = selectTurn(store, trimmed)
    if (!row) {
      throw new StoreError('Turn not found', 404)
    }
    if (row.outcome === 'running') {
      store.sqlite.prepare(`
        UPDATE turns
        SET outcome = ?, ended_at = ?, error_code = ?
        WHERE id = ?
      `).run(outcome, now, errorCode, row.id)
    }
    store.sqlite.prepare(`
      DELETE FROM turns WHERE started_at < ?
    `).run(now - TURN_RETENTION_MS)
    store.sqlite.exec('COMMIT')
  } catch (error) {
    store.sqlite.exec('ROLLBACK')
    throw error
  }
  return getTurn(store, trimmed)
}

export type TurnListFilter = {
  botId?: string | null
  threadId?: string | null
  scheduleId?: string | null
  trigger?: TurnTrigger | null
  since?: string | number | null
  limit?: number | null
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length > ID_MAX) {
    throw new StoreError('Turn filter is too long', 400)
  }
  return trimmed
}

export function parseTurnSince(value: string | number | null | undefined): number | null {
  if (value == null || value === '') {
    return null
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new StoreError('since must be a time', 400)
    }
    return value
  }
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed)
  }
  const ms = Date.parse(trimmed)
  if (Number.isNaN(ms)) {
    throw new StoreError('since must be a time', 400)
  }
  return ms
}

function parseLimit(value: number | null | undefined): number {
  if (value == null) {
    return TURN_LIST_DEFAULT
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new StoreError('limit must be a positive integer', 400)
  }
  return Math.min(value, TURN_LIST_MAX)
}

export function listTurns(store: OpenedStore, filter: TurnListFilter = {}): Turn[] {
  const botId = blankToNull(filter.botId)
  const threadId = blankToNull(filter.threadId)
  const scheduleId = blankToNull(filter.scheduleId)
  const trigger = readTriggerFilter(filter.trigger)
  const since = parseTurnSince(filter.since)
  const limit = parseLimit(filter.limit)
  const rows = store.sqlite.prepare(`
    SELECT ${TURN_COLUMNS}
    FROM turns
    WHERE (? IS NULL OR bot_id = ?)
      AND (? IS NULL OR thread_id = ?)
      AND (? IS NULL OR schedule_id = ?)
      AND (? IS NULL OR trigger = ?)
      AND (? IS NULL OR started_at >= ?)
    ORDER BY started_at DESC, id DESC
    LIMIT ?
  `).all(
    botId,
    botId,
    threadId,
    threadId,
    scheduleId,
    scheduleId,
    trigger,
    trigger,
    since,
    since,
    limit,
  ) as TurnSqlRow[]
  return rows.map(toTurn)
}

function readTriggerFilter(value: TurnTrigger | null | undefined): string | null {
  if (value == null) {
    return null
  }
  if (!isTrigger(value)) {
    throw new StoreError('Turn trigger must be user, wake, or mention', 400)
  }
  return value
}
