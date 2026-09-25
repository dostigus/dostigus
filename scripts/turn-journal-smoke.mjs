/**
 * Smoke the Turn journal on a running Host preview (`pnpm preview:host`).
 *
 * The Host and this script share one MCP bearer. The fixed preview token
 * is `preview-agent`. Set `NUXT_AGENT_TOKEN` (or `DOSTIGUS_MCP_TOKEN`) on
 * both processes. When this script's env is unset it sends Bearer
 * `preview-agent`. An empty token on the Host leaves `/mcp` tools
 * disabled. A call with no bearer fails the same way.
 *
 * The script signs in through `/preview-seed`, posts one Chat line on
 * Bot `preview` (quiet reply, no LLM gateway key), then calls
 * `dostigus_turns_list` and `dostigus_turns_get`. The quiet path writes
 * trigger `user`, outcome `ok`, one `thinking` phase, no tools, a
 * resolved `modelId`, `visionParts` false, and null `servedModelId`
 * / token fields (the quiet path is not an LLM completion).
 *
 *   NUXT_AGENT_TOKEN=preview-agent pnpm preview:host
 *   NUXT_AGENT_TOKEN=preview-agent pnpm smoke:turns
 *
 * PREVIEW_SMOKE_URL (default http://localhost:3000).
 * PREVIEW_SMOKE_WAIT_MS (default 120000) while nuxt dev is still starting.
 */
import { randomUUID } from 'node:crypto'
import process from 'node:process'

const PREVIEW_BOT_ID = 'preview'
const PREVIEW_AGENT_TOKEN = 'preview-agent'
const TURN_PHASES = ['thinking', 'tool', 'typing']
const TURN_KEYS = [
  'id',
  'threadId',
  'botId',
  'personId',
  'trigger',
  'outcome',
  'startedAt',
  'endedAt',
  'scheduleId',
  'errorCode',
  'phases',
  'tools',
  'modelId',
  'modelTier',
  'visionParts',
  'servedModelId',
  'promptTokens',
  'completionTokens',
  'totalTokens',
  'llmCallCount',
]
const BODY_KEYS = [
  'content',
  'body',
  'message',
  'messages',
  'parts',
  'arguments',
  'args',
  'result',
  'results',
  'prompt',
  'prompts',
  'phases_json',
  'tools_json',
]
const WAIT_MS = Number(process.env.PREVIEW_SMOKE_WAIT_MS ?? 120_000)
const REQUEST_MS = 60_000

let base = (process.env.PREVIEW_SMOKE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
let rpcId = 0

function agentToken() {
  return process.env.NUXT_AGENT_TOKEN || process.env.DOSTIGUS_MCP_TOKEN || PREVIEW_AGENT_TOKEN
}

function fail(message) {
  console.error(`turn-journal smoke: ${message}`)
  process.exit(1)
}

function note(message) {
  console.log(`turn-journal smoke: ${message}`)
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function connectionCode(error) {
  const cause = error?.cause
  if (cause?.code) {
    return cause.code
  }
  if (Array.isArray(cause?.errors)) {
    return cause.errors.find((item) => item?.code)?.code
  }
  return error?.code
}

function isRefused(error) {
  const code = connectionCode(error)
  return code === 'ECONNREFUSED' || code === 'EHOSTUNREACH' || code === 'ENOTFOUND' || code === 'EAI_AGAIN'
}

function ipv6Base(url) {
  const parsed = new URL(url)
  if (parsed.hostname !== 'localhost') {
    return null
  }
  parsed.hostname = '::1'
  return parsed.origin
}

function locationPath(value) {
  if (!value) {
    return null
  }
  const url = new URL(value, `${base}/`)
  return `${url.pathname}${url.search}`
}

function cookieHeader(response) {
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : []
  return cookies.map((cookie) => cookie.split(';')[0]).filter(Boolean).join('; ')
}

async function request(path, { method = 'GET', cookie, json, headers = {} } = {}) {
  const nextHeaders = { ...headers }
  if (cookie) {
    nextHeaders.cookie = cookie
  }
  let body
  if (json !== undefined) {
    nextHeaders['content-type'] = 'application/json'
    body = JSON.stringify(json)
  }
  const ipv6 = ipv6Base(base)
  let response
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: nextHeaders,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_MS),
    })
  } catch (error) {
    if (!isRefused(error) || !ipv6) {
      throw error
    }
    response = await fetch(`${ipv6}${path}`, {
      method,
      headers: nextHeaders,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_MS),
    })
    base = ipv6
    note(`using ${base} because localhost refused the connection`)
  }
  const text = await response.text()
  return { response, text }
}

async function waitForHealth() {
  const deadline = Date.now() + WAIT_MS
  let last = 'not started'
  while (Date.now() <= deadline) {
    try {
      const { response, text } = await request('/health')
      if (response.status === 200) {
        return text
      }
      last = `GET /health ${response.status}`
    } catch (error) {
      last = connectionCode(error) ?? error?.message ?? 'unreachable'
    }
    await sleep(1000)
  }
  fail(
    `Host did not answer GET /health at ${base} (${last}). Start \`NUXT_AGENT_TOKEN=${PREVIEW_AGENT_TOKEN} pnpm preview:host\` and open http://localhost:3000/ (not 127.0.0.1).`,
  )
}

function parseJson(text, label) {
  try {
    return JSON.parse(text)
  } catch {
    fail(`${label} was not JSON: ${text.slice(0, 200)}`)
  }
}

function toolText(message) {
  const content = message?.result?.content
  if (!Array.isArray(content)) {
    return ''
  }
  return content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
}

/**
 * One stateless `/mcp` JSON-RPC call. The toolkit returns JSON
 * (`enableJsonResponse`), including tool errors as `result.isError`.
 * A missing tool (no bearer, or an empty Host token) is a JSON-RPC error.
 */
async function mcpCall(method, params, token) {
  const headers = {
    accept: 'application/json, text/event-stream',
  }
  if (token) {
    headers.authorization = `Bearer ${token}`
  }
  rpcId += 1
  const hit = await request('/mcp', {
    method: 'POST',
    headers,
    json: {
      jsonrpc: '2.0',
      id: rpcId,
      method,
      params,
    },
  })
  const message = parseJson(hit.text, `${method} ${hit.response.status}`)
  return { status: hit.response.status, message }
}

function mcpResult(call, label) {
  const message = call.message
  if (message?.error) {
    fail(`${label} failed: ${message.error.message ?? JSON.stringify(message.error)}`)
  }
  if (call.status !== 200) {
    fail(`${label} expected HTTP 200, got ${call.status} ${toolText(message).slice(0, 200)}`)
  }
  if (message?.result?.isError) {
    fail(`${label} tool error: ${toolText(message).slice(0, 300)}`)
  }
  if (!message?.result || typeof message.result !== 'object') {
    fail(`${label} returned no result`)
  }
  return message.result
}

function mcpData(call, label) {
  const result = mcpResult(call, label)
  const text = toolText({ result })
  if (!text) {
    fail(`${label} returned no text content`)
  }
  return parseJson(text, label)
}

function toolNamesFromList(call) {
  const tools = call.message?.result?.tools
  if (!Array.isArray(tools)) {
    return null
  }
  return tools.map((tool) => tool?.name)
}

function mcpFailed(call) {
  if (call.message?.error) {
    return true
  }
  if (call.status !== 200) {
    return true
  }
  return call.message?.result?.isError === true
}

function assertTurnShape(turn, label) {
  if (!turn || typeof turn !== 'object') {
    fail(`${label} was not an object`)
  }
  const keys = Object.keys(turn)
  for (const key of keys) {
    if (!TURN_KEYS.includes(key)) {
      fail(`${label} has unexpected field ${key}`)
    }
  }
  for (const key of BODY_KEYS) {
    if (key in turn) {
      fail(`${label} stored ${key}`)
    }
  }
  if (typeof turn.id !== 'string' || !turn.id) {
    fail(`${label} id was ${JSON.stringify(turn.id)}`)
  }
  if (turn.botId !== PREVIEW_BOT_ID) {
    fail(`${label} botId expected ${PREVIEW_BOT_ID}, got ${turn.botId}`)
  }
  if (typeof turn.threadId !== 'string' || !turn.threadId) {
    fail(`${label} threadId was ${JSON.stringify(turn.threadId)}`)
  }
  if (typeof turn.personId !== 'string' || !turn.personId) {
    fail(`${label} personId was ${JSON.stringify(turn.personId)}`)
  }
  if (turn.trigger !== 'user') {
    fail(`${label} trigger expected user, got ${turn.trigger}`)
  }
  if (turn.outcome !== 'ok') {
    fail(`${label} outcome expected ok, got ${turn.outcome}`)
  }
  if (typeof turn.startedAt !== 'string' || Number.isNaN(Date.parse(turn.startedAt))) {
    fail(`${label} startedAt was ${JSON.stringify(turn.startedAt)}`)
  }
  if (typeof turn.endedAt !== 'string' || Number.isNaN(Date.parse(turn.endedAt))) {
    fail(`${label} endedAt was ${JSON.stringify(turn.endedAt)}`)
  }
  if (turn.scheduleId !== null) {
    fail(`${label} scheduleId expected null, got ${JSON.stringify(turn.scheduleId)}`)
  }
  if (turn.errorCode !== null) {
    fail(`${label} errorCode expected null, got ${JSON.stringify(turn.errorCode)}`)
  }
  if (!Array.isArray(turn.phases)) {
    fail(`${label} phases was not an array`)
  }
  const phaseNames = turn.phases.map((phase) => phase?.phase)
  if (phaseNames.length !== 1 || phaseNames[0] !== 'thinking') {
    fail(`${label} quiet path expected phases [thinking], got ${JSON.stringify(phaseNames)}`)
  }
  for (const phase of turn.phases) {
    const phaseKeys = Object.keys(phase)
    if (phaseKeys.length !== 2 || !phaseKeys.includes('phase') || !phaseKeys.includes('at')) {
      fail(`${label} phase fields were ${JSON.stringify(phaseKeys)}`)
    }
    if (!TURN_PHASES.includes(phase.phase)) {
      fail(`${label} phase ${phase.phase} is outside thinking|tool|typing`)
    }
    if (typeof phase.at !== 'string' || Number.isNaN(Date.parse(phase.at))) {
      fail(`${label} phase at was ${JSON.stringify(phase.at)}`)
    }
  }
  if (!Array.isArray(turn.tools) || turn.tools.length !== 0) {
    fail(`${label} quiet path expected tools [], got ${JSON.stringify(turn.tools)}`)
  }
  if (typeof turn.modelId !== 'string' || !turn.modelId.trim()) {
    fail(`${label} modelId expected a non-empty id, got ${JSON.stringify(turn.modelId)}`)
  }
  if (typeof turn.modelTier !== 'string' || !turn.modelTier.trim()) {
    fail(`${label} modelTier expected a tier, got ${JSON.stringify(turn.modelTier)}`)
  }
  if (typeof turn.visionParts !== 'boolean') {
    fail(`${label} visionParts expected a boolean, got ${JSON.stringify(turn.visionParts)}`)
  }
  if (turn.visionParts !== false) {
    fail(`${label} quiet path expected visionParts false, got ${JSON.stringify(turn.visionParts)}`)
  }
  if (turn.servedModelId !== null) {
    fail(`${label} quiet path expected servedModelId null, got ${JSON.stringify(turn.servedModelId)}`)
  }
  for (const key of ['promptTokens', 'completionTokens', 'totalTokens', 'llmCallCount']) {
    const value = turn[key]
    if (value !== null) {
      fail(`${label} quiet path expected ${key} null, got ${JSON.stringify(value)}`)
    }
  }
}

function assertNoBodies(turn, userLine, assistantLine) {
  const encoded = JSON.stringify(turn)
  if (encoded.includes(userLine)) {
    fail('Turn row included the Chat line')
  }
  if (assistantLine && encoded.includes(assistantLine)) {
    fail('Turn row included the assistant reply')
  }
  for (const key of BODY_KEYS) {
    if (encoded.includes(`"${key}"`)) {
      fail(`Turn row included ${key}`)
    }
  }
}

async function listTurns(token, arguments_) {
  const data = mcpData(
    await mcpCall('tools/call', {
      name: 'dostigus_turns_list',
      arguments: arguments_,
    }, token),
    `dostigus_turns_list ${JSON.stringify(arguments_)}`,
  )
  if (!data || !Array.isArray(data.turns)) {
    fail(`dostigus_turns_list did not return turns: ${JSON.stringify(data).slice(0, 200)}`)
  }
  return data.turns
}

async function main() {
  const token = agentToken()
  await waitForHealth()
  note(`GET /health 200 at ${base}`)

  const seeded = await request('/preview-seed')
  const seededPath = locationPath(seeded.response.headers.get('location'))
  const session = cookieHeader(seeded.response)
  if (seeded.response.status === 404) {
    fail('GET /preview-seed is 404. Start `pnpm preview:host` (nuxt dev with DOSTIGUS_PREVIEW_SEED=1).')
  }
  if (seeded.response.status === 409) {
    fail('GET /preview-seed is 409. This Store Owner is not preview. Point DATABASE_URL at a fresh file (for example file:.data/preview.sqlite).')
  }
  if (seeded.response.status !== 302 || seededPath !== `/bots/${PREVIEW_BOT_ID}`) {
    fail(`GET /preview-seed expected 302 /bots/${PREVIEW_BOT_ID}, got ${seeded.response.status} ${seededPath ?? seeded.text.slice(0, 200)}`)
  }
  if (!session) {
    fail('GET /preview-seed did not set a session cookie')
  }
  note(`GET /preview-seed 302 /bots/${PREVIEW_BOT_ID}`)

  const listed = await mcpCall('tools/list', {}, token)
  const names = mcpFailed(listed) ? null : toolNamesFromList(listed)
  if (!names) {
    fail(
      `tools/list did not return tools (${listed.status} ${JSON.stringify(listed.message).slice(0, 200)}). Start the Host with NUXT_AGENT_TOKEN=${token}.`,
    )
  }
  if (!names.includes('dostigus_turns_list') || !names.includes('dostigus_turns_get')) {
    fail(
      `tools/list omitted the Turn journal tools. Start the Host with NUXT_AGENT_TOKEN=${token} (same value this smoke sends). An empty token leaves tools disabled.`,
    )
  }

  const before = await listTurns(token, { botId: PREVIEW_BOT_ID })
  const beforeIds = new Set(before.map((turn) => turn.id))

  const userLine = `turn-journal-smoke:${randomUUID()}`
  const posted = await request(`/api/bots/${PREVIEW_BOT_ID}/messages`, {
    method: 'POST',
    cookie: session,
    json: { content: userLine },
  })
  if (posted.response.status !== 200) {
    fail(`POST /api/bots/${PREVIEW_BOT_ID}/messages expected 200, got ${posted.response.status} ${posted.text.slice(0, 300)}`)
  }
  const reply = parseJson(posted.text, 'POST messages')
  if (reply?.via !== 'stub') {
    fail(`quiet reply expected via stub (no LLM gateway key), got ${JSON.stringify(reply?.via)}. Point this preview Host at a Store with no key.`)
  }
  const assistantLine = reply?.assistant?.content
  if (typeof assistantLine !== 'string' || !assistantLine) {
    fail('quiet reply did not return an assistant line')
  }
  note('POST Chat line via stub')

  const after = await listTurns(token, { botId: PREVIEW_BOT_ID })
  const created = after.filter((turn) => !beforeIds.has(turn.id))
  if (created.length !== 1) {
    fail(`expected 1 new Turn for Bot ${PREVIEW_BOT_ID}, found ${created.length}`)
  }
  const turn = created[0]
  assertTurnShape(turn, 'list')
  assertNoBodies(turn, userLine, assistantLine)
  if (after[0]?.id !== turn.id) {
    fail('dostigus_turns_list did not return the new Turn first')
  }

  const got = mcpData(
    await mcpCall('tools/call', {
      name: 'dostigus_turns_get',
      arguments: { id: turn.id },
    }, token),
    'dostigus_turns_get',
  )
  if (got?.turn?.id !== turn.id) {
    fail(`dostigus_turns_get returned ${JSON.stringify(got?.turn?.id)}`)
  }
  assertTurnShape(got.turn, 'get')
  assertNoBodies(got.turn, userLine, assistantLine)
  if (JSON.stringify(got.turn) !== JSON.stringify(turn)) {
    fail('dostigus_turns_get did not match dostigus_turns_list')
  }

  const byThread = await listTurns(token, { threadId: turn.threadId })
  if (!byThread.some((item) => item.id === turn.id)) {
    fail('threadId filter omitted the Turn')
  }
  const otherThread = await listTurns(token, { threadId: 'not-a-thread' })
  if (otherThread.some((item) => item.id === turn.id)) {
    fail('threadId filter returned the Turn for another thread')
  }
  const otherBot = await listTurns(token, { botId: 'not-a-bot' })
  if (otherBot.some((item) => item.id === turn.id)) {
    fail('botId filter returned the Turn for another Bot')
  }
  const limited = await listTurns(token, { botId: PREVIEW_BOT_ID, limit: 1 })
  if (limited.length !== 1 || limited[0]?.id !== turn.id) {
    fail(`limit 1 expected the new Turn, got ${limited.length} row(s)`)
  }
  const future = await listTurns(token, { botId: PREVIEW_BOT_ID, since: '2099-01-01T00:00:00.000Z' })
  if (future.some((item) => item.id === turn.id)) {
    fail('since filter included a Turn that started earlier')
  }
  note(`filters botId threadId limit since; Turn ${turn.id} outcome ok`)

  const missing = await mcpCall('tools/call', {
    name: 'dostigus_turns_get',
    arguments: { id: 'missing-turn' },
  }, token)
  const missingText = toolText(missing.message)
  if (!missing.message?.result?.isError || !missingText.includes('Turn not found')) {
    fail(`dostigus_turns_get missing id expected a Turn not found tool error, got ${missing.status} ${missingText.slice(0, 300) || JSON.stringify(missing.message).slice(0, 300)}`)
  }
  note('dostigus_turns_get missing id failed cleanly')

  const anonymous = await mcpCall('tools/call', {
    name: 'dostigus_turns_list',
    arguments: { botId: PREVIEW_BOT_ID },
  })
  if (!mcpFailed(anonymous)) {
    fail('dostigus_turns_list succeeded with no bearer. Soft auth should leave the tool disabled.')
  }
  const anonymousList = await mcpCall('tools/list', {})
  if (!mcpFailed(anonymousList)) {
    const anonNames = toolNamesFromList(anonymousList) ?? []
    if (anonNames.includes('dostigus_turns_list') || anonNames.includes('dostigus_turns_get')) {
      fail('tools/list included Turn journal tools with no bearer')
    }
  }
  note('no bearer: Turn journal tools stay disabled')
  note(`ok Turn ${turn.id} trigger=user outcome=ok phases=thinking tools=[] modelId=${turn.modelId} visionParts=${turn.visionParts} servedModelId=${turn.servedModelId} llmCallCount=${turn.llmCallCount}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
