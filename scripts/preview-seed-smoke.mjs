/**
 * Smoke a running Host preview (`pnpm preview:host`).
 *
 * HEAD /health must stay 200. h3 turns `return null` after
 * setResponseStatus(200) into 204, so that handler sets content-length
 * to the GET JSON byte length and ends with an empty body.
 * HEAD /preview-seed is 204 until the stable New Bot exists, then 302.
 *
 *   pnpm preview:host
 *   pnpm smoke:preview
 *
 * PREVIEW_SMOKE_URL (default http://localhost:3000).
 * PREVIEW_SMOKE_WAIT_MS (default 120000) while nuxt dev is still starting.
 */
import process from 'node:process'

const DEFAULT_BOT_NAME = 'New Bot'
const GREETING = 'Hello — I\'m New Bot.'
const TALL_PREFIX = 'Preview layout line '
const TALL_COUNT = 32
const WAIT_MS = Number(process.env.PREVIEW_SMOKE_WAIT_MS ?? 120_000)
const REQUEST_MS = 60_000

let base = (process.env.PREVIEW_SMOKE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

function fail(message) {
  console.error(`preview-seed smoke: ${message}`)
  process.exit(1)
}

function note(message) {
  console.log(`preview-seed smoke: ${message}`)
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

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength
}

function locationPath(value) {
  if (!value) {
    return null
  }
  const url = new URL(value, `${base}/`)
  return `${url.pathname}${url.search}`
}

function botIdFromLocation(path) {
  const match = path?.match(/^\/bots\/([^/?#]+)$/)
  return match?.[1] ?? null
}

function cookieHeader(response) {
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : []
  return cookies.map((cookie) => cookie.split(';')[0]).filter(Boolean).join('; ')
}

async function request(path, { method = 'GET', cookie } = {}) {
  const headers = {}
  if (cookie) {
    headers.cookie = cookie
  }
  const ipv6 = ipv6Base(base)
  let response
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_MS),
    })
  } catch (error) {
    if (!isRefused(error) || !ipv6) {
      throw error
    }
    response = await fetch(`${ipv6}${path}`, {
      method,
      headers,
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
        return { response, text }
      }
      last = `GET /health ${response.status}`
    } catch (error) {
      last = connectionCode(error) ?? error?.message ?? 'unreachable'
    }
    await sleep(1000)
  }
  fail(
    `Host did not answer GET /health at ${base} (${last}). Start \`pnpm preview:host\` and open http://localhost:3000/ (not 127.0.0.1).`,
  )
}

function assertHealthHead(getBody, head) {
  const type = head.response.headers.get('content-type') ?? ''
  const length = head.response.headers.get('content-length')
  const expected = String(byteLength(getBody))
  if (head.response.status === 204) {
    fail(
      'HEAD /health is 204. h3 turns `return null` after setResponseStatus(200) into 204. Keep the empty-body content-length pattern in apps/web/server/routes/health.head.ts.',
    )
  }
  if (head.response.status !== 200) {
    fail(`HEAD /health expected 200, got ${head.response.status}`)
  }
  if (!type.includes('application/json')) {
    fail(`HEAD /health content-type expected application/json, got ${type || '(none)'}`)
  }
  if (length !== expected) {
    fail(`HEAD /health content-length expected ${expected} (GET body bytes), got ${length ?? '(none)'}`)
  }
  if (head.text !== '') {
    fail('HEAD /health body was not empty')
  }
  if (cookieHeader(head.response)) {
    fail('HEAD /health set a session cookie')
  }
  note(`HEAD /health 200 ${type.split(';')[0]} content-length=${length} body empty`)
}

function assertPreviewHead(head, expected) {
  const status = head.response.status
  const location = locationPath(head.response.headers.get('location'))
  if (status === 404) {
    fail('HEAD /preview-seed is 404. The route is closed unless this is nuxt dev with DOSTIGUS_PREVIEW_SEED=1 (`pnpm preview:host`).')
  }
  if (status === 409) {
    fail('HEAD /preview-seed is 409. This Store Owner is not preview. Point DATABASE_URL at a fresh file (for example file:.data/preview.sqlite) or sign in at /login.')
  }
  if (cookieHeader(head.response)) {
    fail(`HEAD /preview-seed ${status} set a session cookie`)
  }
  if (expected) {
    if (status !== expected.status || location !== expected.location) {
      fail(`HEAD /preview-seed changed from ${expected.status} ${expected.location ?? ''} to ${status} ${location ?? ''} without a GET`)
    }
    return { status, location }
  }
  if (status === 204) {
    if (location) {
      fail(`HEAD /preview-seed 204 included location ${location}`)
    }
    return { status, location: null }
  }
  if (status === 302) {
    const botId = botIdFromLocation(location)
    if (!botId) {
      fail(`HEAD /preview-seed 302 location was ${location ?? '(none)'}, expected /bots/<id>`)
    }
    return { status, location }
  }
  fail(`HEAD /preview-seed expected 204 or 302, got ${status}`)
}

function stableNewBotId(bots) {
  let match = null
  for (let index = bots.length - 1; index >= 0; index--) {
    const bot = bots[index]
    if (bot?.name !== DEFAULT_BOT_NAME) {
      continue
    }
    if (!match || bot.createdAt < match.createdAt) {
      match = bot
    }
  }
  return match?.id ?? null
}

function assertTall(messages) {
  const tall = messages.filter((message) => message.content.startsWith(TALL_PREFIX))
  if (tall.length !== TALL_COUNT) {
    fail(`expected ${TALL_COUNT} tall Chat lines, found ${tall.length}`)
  }
  for (let index = 0; index < tall.length; index++) {
    const line = index + 1
    const message = tall[index]
    const role = line % 2 === 1 ? 'user' : 'assistant'
    if (!message.content.startsWith(`${TALL_PREFIX}${line}.`)) {
      fail(`tall line ${line} content was ${JSON.stringify(message.content)}`)
    }
    if (message.role !== role) {
      fail(`tall line ${line} role expected ${role}, got ${message.role}`)
    }
    if (role === 'user' && !message.personId) {
      fail(`tall line ${line} is missing personId`)
    }
    if (role === 'assistant' && message.personId != null) {
      fail(`tall line ${line} set personId`)
    }
    if (index > 0 && Date.parse(message.createdAt) <= Date.parse(tall[index - 1].createdAt)) {
      fail('tall Chat lines are not in createdAt order')
    }
  }
}

async function readJson(path, cookie) {
  const hit = await request(path, { cookie })
  if (hit.response.status !== 200) {
    fail(`${path} expected 200, got ${hit.response.status} ${hit.text.slice(0, 200)}`)
  }
  try {
    return JSON.parse(hit.text)
  } catch {
    fail(`${path} was not JSON`)
  }
}

async function main() {
  const healthGet = await waitForHealth()
  let healthBody
  try {
    healthBody = JSON.parse(healthGet.text)
  } catch {
    fail(`GET /health was not JSON: ${healthGet.text.slice(0, 200)}`)
  }
  if (healthBody?.ok !== true) {
    fail(`GET /health body expected { ok: true }, got ${healthGet.text.slice(0, 200)}`)
  }

  const healthHead = await request('/health', { method: 'HEAD' })
  assertHealthHead(healthGet.text, healthHead)

  const firstHead = assertPreviewHead(await request('/preview-seed', { method: 'HEAD' }))
  const secondHead = assertPreviewHead(await request('/preview-seed', { method: 'HEAD' }), firstHead)
  note(
    firstHead.status === 204
      ? 'HEAD /preview-seed 204 (stable Bot not created yet); repeated HEAD stayed 204'
      : `HEAD /preview-seed 302 ${firstHead.location}; repeated HEAD stayed 302`,
  )
  if (secondHead.status !== firstHead.status) {
    fail('repeated HEAD /preview-seed did not match')
  }

  const seeded = await request('/preview-seed')
  const seededPath = locationPath(seeded.response.headers.get('location'))
  const botId = botIdFromLocation(seededPath)
  const session = cookieHeader(seeded.response)
  if (seeded.response.status !== 302 || !botId) {
    fail(`GET /preview-seed expected 302 /bots/<id>, got ${seeded.response.status} ${seededPath ?? seeded.text.slice(0, 200)}`)
  }
  if (!session) {
    fail('GET /preview-seed did not set a session cookie')
  }
  if (firstHead.status === 302 && seededPath !== firstHead.location) {
    fail(`GET /preview-seed went to ${seededPath}, HEAD had ${firstHead.location}`)
  }

  const listed = await readJson('/api/bots', session)
  const bots = listed?.bots
  if (!Array.isArray(bots)) {
    fail('GET /api/bots did not return bots')
  }
  const stableId = stableNewBotId(bots)
  if (stableId !== botId) {
    fail(`GET /preview-seed landed on ${botId}, stable New Bot is ${stableId ?? '(none)'}`)
  }
  const bot = bots.find((item) => item.id === botId)
  if (bot?.name !== DEFAULT_BOT_NAME) {
    fail(`Chat Bot name expected ${DEFAULT_BOT_NAME}, got ${bot?.name ?? '(missing)'}`)
  }
  note(`GET /preview-seed 302 /bots/${botId} (${DEFAULT_BOT_NAME})`)

  const before = await readJson(`/api/bots/${botId}/messages`, session)
  const beforeMessages = before?.messages
  if (!Array.isArray(beforeMessages) || beforeMessages.length === 0) {
    fail('Chat has no messages')
  }
  if (beforeMessages[0]?.role !== 'assistant' || beforeMessages[0]?.content !== GREETING) {
    fail(`Chat greeting expected ${JSON.stringify(GREETING)}, got ${JSON.stringify(beforeMessages[0]?.content)}`)
  }
  const hadTall = beforeMessages.some((message) => message.content.startsWith(TALL_PREFIX))

  const tall = await request('/preview-seed?tall=1', { cookie: session })
  const tallPath = locationPath(tall.response.headers.get('location'))
  if (tall.response.status !== 302 || tallPath !== `/bots/${botId}`) {
    fail(`GET /preview-seed?tall=1 expected 302 /bots/${botId}, got ${tall.response.status} ${tallPath ?? ''}`)
  }

  const after = await readJson(`/api/bots/${botId}/messages`, session)
  const afterMessages = after?.messages
  if (!Array.isArray(afterMessages)) {
    fail('Chat messages missing after ?tall=1')
  }
  assertTall(afterMessages)
  if (hadTall && afterMessages.length !== beforeMessages.length) {
    fail(`?tall=1 appended again (${beforeMessages.length} → ${afterMessages.length})`)
  }
  if (!hadTall && afterMessages.length !== beforeMessages.length + TALL_COUNT) {
    fail(`?tall=1 expected ${TALL_COUNT} new lines (${beforeMessages.length} → ${afterMessages.length})`)
  }

  const again = await request('/preview-seed?tall=1', { cookie: session })
  if (again.response.status !== 302 || locationPath(again.response.headers.get('location')) !== `/bots/${botId}`) {
    fail('second GET /preview-seed?tall=1 did not return to the same Chat')
  }
  const kept = await readJson(`/api/bots/${botId}/messages`, session)
  if (!Array.isArray(kept?.messages) || kept.messages.length !== afterMessages.length) {
    fail(`second ?tall=1 changed Chat length (${afterMessages.length} → ${kept?.messages?.length ?? 'none'})`)
  }
  note(`?tall=1 has ${TALL_COUNT} preview lines (${afterMessages.length} Chat lines); second GET did not append`)

  const afterHead = assertPreviewHead(await request('/preview-seed', { method: 'HEAD' }))
  if (afterHead.status !== 302 || afterHead.location !== `/bots/${botId}`) {
    fail(`HEAD /preview-seed after GET expected 302 /bots/${botId}, got ${afterHead.status} ${afterHead.location ?? ''}`)
  }
  const afterHeadMessages = await readJson(`/api/bots/${botId}/messages`, session)
  if (afterHeadMessages?.messages?.length !== afterMessages.length) {
    fail('HEAD /preview-seed inserted Chat lines')
  }
  note(`HEAD /preview-seed 302 /bots/${botId} with no session cookie`)
  note('ok')
}

await main()
