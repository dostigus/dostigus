import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createBot, getLlmGatewaySettings, listBots, listBotThreadMessages, listKitchenPantry, listMessages, listSchedules, listThreadMessages, listTurns, openStore, readKitchen, updateBot } from '@dostigus/db'
import { DEFAULT_BOT_NAME, mentionedRoomBot } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import { OwnerAuthError, registerClusterOwner } from '../../server/utils/owner-auth'
import {
  ensurePreviewCluster,
  ensurePreviewOpenRouterProvider,
  PREVIEW_BOT_ID,
  PREVIEW_DM_PREFIX,
  PREVIEW_DM_REPLY_PREFIX,
  PREVIEW_DM_THREAD_ID,
  PREVIEW_KITCHEN_PREFIX,
  PREVIEW_MEMBER_LOGIN,
  PREVIEW_MEMBER_THREAD_PREFIX,
  PREVIEW_OPENROUTER_KEY,
  PREVIEW_OPENROUTER_PROVIDER_ID,
  PREVIEW_OWNER_LOGIN,
  PREVIEW_OWNER_PASSWORD,
  PREVIEW_OWNER_THREAD_PREFIX,
  PREVIEW_PARTS_PREFIX,
  PREVIEW_PRIVATE_BOT_ID,
  PREVIEW_PRIVATE_THREAD_PREFIX,
  PREVIEW_ROOM_PREFIX,
  PREVIEW_ROOM_REPLY_PREFIX,
  PREVIEW_ROOM_THREAD_ID,
  PREVIEW_SCHEDULE_NAME,
  PREVIEW_SCHEDULE_WAKE,
  PREVIEW_SCHEDULES_PREFIX,
  PREVIEW_SYSTEM_LINES,
  PREVIEW_TALL_LINE_COUNT,
  PREVIEW_TALL_PREFIX,
  previewCatalogSkipsKeyProbe,
  previewKitchenParts,
  previewKitchenRequested,
  previewMembersRequested,
  previewParts,
  previewPartsRequested,
  previewProvidersRequested,
  previewRoomsRequested,
  previewScheduleCard,
  previewSchedulesRequested,
  previewSeedAllowed,
  previewSeedRedirect,
  previewSettingsRequested,
  previewSystemRequested,
  previewTallRequested,
  previewThreadAsMember,
  previewThreadsRequested,
  readPreviewSeedHead,
  stablePreviewBotId,
} from '../../server/utils/preview-seed'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

async function hashPassword(password: string) {
  return `hash:${password}`
}

async function verifyPassword(hash: string, password: string) {
  return hash === `hash:${password}`
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('allows the preview seed only for nuxt dev with the flag set to 1', () => {
  expect(previewSeedAllowed({ dev: true, flag: '1' })).toBe(true)
  expect(previewSeedAllowed({ dev: true, flag: undefined })).toBe(false)
  expect(previewSeedAllowed({ dev: true, flag: 'true' })).toBe(false)
  expect(previewSeedAllowed({ dev: true, flag: '0' })).toBe(false)
  expect(previewSeedAllowed({ dev: false, flag: '1' })).toBe(false)
})

it('creates the preview Owner, one Bot, and a greeting, then reuses them', async () => {
  const store = memoryStore()
  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  expect(first.user.role).toBe('owner')
  expect(first.user.username).toBe(PREVIEW_OWNER_LOGIN)
  expect(first.botId).toBe(PREVIEW_BOT_ID)
  const second = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  expect(second.user.id).toBe(first.user.id)
  expect(second.botId).toBe(first.botId)
  const bots = listBots(store)
  expect(bots).toHaveLength(1)
  expect(bots[0]?.name).toBe(DEFAULT_BOT_NAME)
  const messages = listMessages(store, first.botId)
  expect(messages).toHaveLength(1)
  expect(messages[0]?.role).toBe('assistant')
  expect(messages[0]?.content).toContain(DEFAULT_BOT_NAME)
})

it('refuses a Store whose Owner is not the preview login', async () => {
  const store = memoryStore()
  await registerClusterOwner(store, {
    login: 'ada',
    password: 'secret-pass',
  }, hashPassword)
  await expect(ensurePreviewCluster(store, hashPassword, verifyPassword))
    .rejects
    .toBeInstanceOf(OwnerAuthError)
})

it('keeps the preview seed route closed unless the gate allows it', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../server/routes/preview-seed.get.ts'),
    'utf8',
  )
  expect(src).toContain('previewSeedAllowed')
  expect(src).toContain('previewTallRequested')
  expect(src).toContain('members: query.members')
  expect(src).toContain('settings: query.settings')
  expect(src).toContain('previewPartsRequested')
  expect(src).toContain('previewKitchenRequested')
  expect(src).toContain('previewSchedulesRequested')
  expect(src).toContain('previewSystemRequested')
  expect(src).toContain('previewThreadsRequested')
  expect(src).toContain('previewRoomsRequested')
  expect(src).toContain('previewThreadAsMember')
  expect(src).toContain('previewSeedRedirect({')
  expect(src).toContain('statusCode: 404')
  expect(src).toContain('startOwnerSession')
  expect(src).toContain('sendRedirect')
  expect(src).toContain('PREVIEW_SEED_OWNER_CONFLICT')
  expect(src).not.toContain('requireOwnerSession')
  expect(src).not.toContain('requireHostSession')
  expect(src).not.toContain('requireUserSession')
  expect(PREVIEW_OWNER_PASSWORD.length).toBeGreaterThanOrEqual(8)
})

it('answers HEAD without signing in or writing the Store', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../server/routes/preview-seed.head.ts'),
    'utf8',
  )
  expect(src).toContain('previewSeedAllowed')
  expect(src).toContain('readPreviewSeedHead')
  expect(src).toContain('setResponseStatus(event, 404')
  expect(src).toContain('setResponseStatus(event, 204)')
  expect(src).not.toContain('startOwnerSession')
  expect(src).not.toContain('ensurePreviewCluster')
  expect(src).not.toContain('previewChatLocation')
  expect(src).not.toContain('previewSeedRedirect')
  expect(src).not.toContain('previewMembersRequested')
  expect(src).not.toContain('previewSettingsRequested')
  expect(src).not.toContain('previewKitchenRequested')
  expect(src).not.toContain('previewSchedulesRequested')
  expect(src).not.toContain('previewSystemRequested')
  expect(src).not.toContain('previewThreadsRequested')
  expect(src).not.toContain('previewRoomsRequested')
  expect(src).not.toContain('/members')
  expect(src).not.toContain('requireOwnerSession')
  expect(src).not.toContain('requireHostSession')
  expect(src).not.toContain('requireUserSession')
})

it('treats tall=1 as the layout-thread query', () => {
  expect(previewTallRequested('1')).toBe(true)
  expect(previewTallRequested(1)).toBe(true)
  expect(previewTallRequested(['1'])).toBe(true)
  expect(previewTallRequested(undefined)).toBe(false)
  expect(previewTallRequested('true')).toBe(false)
  expect(previewTallRequested('0')).toBe(false)
})

it('treats members=1 as the Members landing query', () => {
  expect(previewMembersRequested('1')).toBe(true)
  expect(previewMembersRequested(1)).toBe(true)
  expect(previewMembersRequested(['1'])).toBe(true)
  expect(previewMembersRequested(undefined)).toBe(false)
  expect(previewMembersRequested('true')).toBe(false)
  expect(previewMembersRequested('0')).toBe(false)
})

it('turns Nuxt devtools off only while the preview seed flag is set', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../nuxt.config.ts'),
    'utf8',
  )
  expect(src).toContain('DOSTIGUS_PREVIEW_SEED === \'1\'')
  expect(src).toContain('devtools:')
  expect(src).toContain('enabled: false')
  expect(src).toContain('nuxt-devtools-frame')
})

it('does not look up the preview Bot by display name', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../server/utils/preview-seed.ts'),
    'utf8',
  )
  expect(src).toContain('export const PREVIEW_BOT_ID = \'preview\'')
  expect(src).toContain('id: PREVIEW_BOT_ID')
  expect(src).not.toMatch(/\.name\s*[!=]==?\s*DEFAULT_BOT_NAME/)
})

it('selects the fixture Bot id and ignores display name', () => {
  expect(PREVIEW_BOT_ID).toBe('preview')
  expect(stablePreviewBotId([
    { id: 'newer', name: DEFAULT_BOT_NAME },
    { id: PREVIEW_BOT_ID, name: 'Шеф' },
    { id: 'older', name: DEFAULT_BOT_NAME },
  ] as Array<{ id: string }>)).toBe(PREVIEW_BOT_ID)
  expect(stablePreviewBotId([
    { id: 'older', name: DEFAULT_BOT_NAME },
    { id: 'newer', name: DEFAULT_BOT_NAME },
  ] as Array<{ id: string }>)).toBeNull()
})

it('keeps the fixture Bot when a newer Bot is added', async () => {
  const store = memoryStore()
  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  const pantry = createBot(store, { name: 'Pantry' })
  const again = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  expect(again.botId).toBe(PREVIEW_BOT_ID)
  expect(again.botId).toBe(first.botId)
  expect(again.botId).not.toBe(pantry.bot.id)
  expect(listBots(store)).toHaveLength(2)
})

it('keeps the fixture Bot after its name changes', async () => {
  const store = memoryStore()
  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  updateBot(store, first.botId, { name: 'Шеф' })
  const decoy = createBot(store, { name: DEFAULT_BOT_NAME })
  const again = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  expect(again.botId).toBe(PREVIEW_BOT_ID)
  expect(again.botId).not.toBe(decoy.bot.id)
  expect(listBots(store)).toHaveLength(2)
  expect(listBots(store).find((bot) => bot.id === PREVIEW_BOT_ID)?.name).toBe('Шеф')
  expect(readPreviewSeedHead(store)).toEqual({
    statusCode: 302,
    location: `/bots/${PREVIEW_BOT_ID}`,
  })
})

it('creates the fixture Bot when the Store only has another New Bot', async () => {
  const store = memoryStore()
  await registerClusterOwner(store, {
    login: PREVIEW_OWNER_LOGIN,
    password: PREVIEW_OWNER_PASSWORD,
  }, hashPassword)
  const named = createBot(store, { name: DEFAULT_BOT_NAME })
  expect(readPreviewSeedHead(store)).toEqual({ statusCode: 204 })
  const seeded = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  expect(seeded.botId).toBe(PREVIEW_BOT_ID)
  expect(seeded.botId).not.toBe(named.bot.id)
  expect(listBots(store).find((bot) => bot.id === seeded.botId)?.name).toBe(DEFAULT_BOT_NAME)
  expect(listMessages(store, named.bot.id)).toHaveLength(1)
  expect(listBots(store)).toHaveLength(2)
})

it('adds one assistant parts line once, after any tall thread', async () => {
  const store = memoryStore()
  expect(previewPartsRequested('1')).toBe(true)
  expect(previewPartsRequested(1)).toBe(true)
  expect(previewPartsRequested(undefined)).toBe(false)

  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword, {
    tall: true,
    parts: true,
  })
  const messages = listMessages(store, first.botId)
  expect(messages).toHaveLength(1 + PREVIEW_TALL_LINE_COUNT + 1)
  expect(messages[0]?.parts).toEqual([])
  const partsLine = messages.at(-1)
  expect(partsLine?.role).toBe('assistant')
  expect(partsLine?.personId).toBeNull()
  expect(partsLine?.content.startsWith(PREVIEW_PARTS_PREFIX)).toBe(true)
  expect(partsLine?.parts).toEqual(previewParts())
  expect(Date.parse(partsLine!.createdAt)).toBeGreaterThan(Date.parse(messages.at(-2)!.createdAt))
  expect(messages.filter((message) => message.content.startsWith(PREVIEW_PARTS_PREFIX))).toHaveLength(1)

  const second = await ensurePreviewCluster(store, hashPassword, verifyPassword, {
    tall: true,
    parts: true,
  })
  expect(second.botId).toBe(first.botId)
  expect(listMessages(store, first.botId)).toHaveLength(messages.length)
})

it('adds one Kitchen button once and fills empty Kitchen tables', async () => {
  const store = memoryStore()
  expect(previewKitchenRequested('1')).toBe(true)
  expect(previewKitchenRequested(1)).toBe(true)
  expect(previewKitchenRequested(undefined)).toBe(false)

  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword, {
    parts: true,
    kitchen: true,
  })
  const messages = listMessages(store, first.botId)
  const kitchenLine = messages.at(-1)
  expect(kitchenLine?.content.startsWith(PREVIEW_KITCHEN_PREFIX)).toBe(true)
  expect(kitchenLine?.role).toBe('assistant')
  expect(kitchenLine?.parts).toEqual(previewKitchenParts())
  expect(messages.at(-2)?.content.startsWith(PREVIEW_PARTS_PREFIX)).toBe(true)
  expect(Date.parse(kitchenLine!.createdAt)).toBeGreaterThan(Date.parse(messages.at(-2)!.createdAt))
  const kitchen = readKitchen(store)
  expect(kitchen.pantry.map((item) => item.name)).toEqual(['Eggs', 'Milk'])
  expect(kitchen.pantry[0]?.qty).toBe('6')
  expect(kitchen.pantry[1]?.qty).toBeNull()
  expect(kitchen.recipe).toMatchObject({ name: 'Omelette', ingredients: 'eggs\nmilk' })
  expect(kitchen.xp).toBe(10)
  expect(kitchen.cooked[0]?.label).toBe('Omelette')
  expect(kitchen.cooked[0]?.personId).toBe(first.user.id)

  await ensurePreviewCluster(store, hashPassword, verifyPassword, { kitchen: true })
  expect(listMessages(store, first.botId)).toHaveLength(messages.length)
  expect(listKitchenPantry(store)).toHaveLength(2)
  expect(readKitchen(store).xp).toBe(10)
})

it('adds this person\'s Schedules, wake history, and one Card once', async () => {
  const store = memoryStore()
  expect(previewSchedulesRequested('1')).toBe(true)
  expect(previewSchedulesRequested(1)).toBe(true)
  expect(previewSchedulesRequested(undefined)).toBe(false)

  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword, {
    schedules: true,
  })
  const rows = listSchedules(store, { botId: first.botId, personId: first.user.id })
  expect(rows).toHaveLength(2)
  const named = rows.find((row) => row.name === PREVIEW_SCHEDULE_NAME)
  expect(named?.timeLocal).toBe('08:02')
  expect(named?.wakeText).toBe(PREVIEW_SCHEDULE_WAKE)
  expect(rows.some((row) => row.name === '' && row.paused)).toBe(true)
  expect(listTurns(store, { scheduleId: named?.id, trigger: 'wake' })).toHaveLength(3)

  const messages = listMessages(store, first.botId)
  const cardLine = messages.find((message) => message.content.startsWith(PREVIEW_SCHEDULES_PREFIX))
  expect(cardLine?.role).toBe('assistant')
  expect(cardLine?.parts).toEqual(previewScheduleCard(named!.id))

  await ensurePreviewCluster(store, hashPassword, verifyPassword, { schedules: true })
  expect(listSchedules(store, { botId: first.botId, personId: first.user.id })).toHaveLength(2)
  expect(listMessages(store, first.botId)).toHaveLength(messages.length)
})

it('adds three system Skill / self-settings lines once, after parts', async () => {
  const store = memoryStore()
  expect(previewSystemRequested('1')).toBe(true)
  expect(previewSystemRequested(1)).toBe(true)
  expect(previewSystemRequested(['1'])).toBe(true)
  expect(previewSystemRequested(undefined)).toBe(false)
  expect(previewSystemRequested('true')).toBe(false)
  expect(previewSystemRequested('0')).toBe(false)

  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword, {
    parts: true,
    system: true,
  })
  const messages = listMessages(store, first.botId)
  const systemLines = messages.filter((message) => message.role === 'system')
  expect(systemLines).toHaveLength(PREVIEW_SYSTEM_LINES.length)
  expect(systemLines.map((message) => message.content)).toEqual([...PREVIEW_SYSTEM_LINES])
  expect(systemLines.every((message) => message.parts.length === 0)).toBe(true)
  expect(systemLines.every((message) => message.personId === null)).toBe(true)
  const ownerThread = listBotThreadMessages(store, first.botId, first.user.id)
  expect(ownerThread.filter((message) => message.role === 'system').map((message) => message.content))
    .toEqual([...PREVIEW_SYSTEM_LINES])
  const partsLine = messages.find((message) => message.content.startsWith(PREVIEW_PARTS_PREFIX))
  expect(partsLine).toBeDefined()
  expect(Date.parse(systemLines[0]!.createdAt)).toBeGreaterThan(Date.parse(partsLine!.createdAt))
  for (let index = 1; index < systemLines.length; index++) {
    expect(Date.parse(systemLines[index]!.createdAt)).toBeGreaterThan(Date.parse(systemLines[index - 1]!.createdAt))
  }

  const second = await ensurePreviewCluster(store, hashPassword, verifyPassword, { system: true })
  expect(second.botId).toBe(first.botId)
  expect(listMessages(store, first.botId)).toHaveLength(messages.length)
  expect(listMessages(store, first.botId).filter((message) => message.role === 'system')).toHaveLength(3)
})

it('fills a tall thread once on the stable Bot', async () => {
  const store = memoryStore()
  const first = await ensurePreviewCluster(store, hashPassword, verifyPassword, { tall: true })
  const pantry = createBot(store, { name: 'Pantry' })
  const messages = listMessages(store, first.botId)
  expect(messages).toHaveLength(1 + PREVIEW_TALL_LINE_COUNT)
  expect(messages[0]?.role).toBe('assistant')
  expect(messages[0]?.content).toContain(DEFAULT_BOT_NAME)
  expect(messages[1]?.content).toBe(`${PREVIEW_TALL_PREFIX}1.`)
  expect(messages[1]?.role).toBe('user')
  expect(messages[1]?.personId).toBe(first.user.id)
  expect(messages.at(-1)?.content.startsWith(`${PREVIEW_TALL_PREFIX}${PREVIEW_TALL_LINE_COUNT}.`)).toBe(true)
  for (let index = 1; index < messages.length; index++) {
    expect(Date.parse(messages[index]!.createdAt)).toBeGreaterThan(Date.parse(messages[index - 1]!.createdAt))
  }
  for (const message of messages) {
    if (message.role === 'user') {
      expect(message.personId).toBe(first.user.id)
    } else {
      expect(message.personId).toBeNull()
    }
  }
  const second = await ensurePreviewCluster(store, hashPassword, verifyPassword, { tall: true })
  expect(second.botId).toBe(first.botId)
  expect(listMessages(store, first.botId)).toHaveLength(messages.length)
  expect(listMessages(store, pantry.bot.id)).toHaveLength(1)
})

it('reads HEAD from the Store without writing', async () => {
  const empty = memoryStore()
  expect(readPreviewSeedHead(empty)).toEqual({ statusCode: 204 })

  const store = memoryStore()
  const seeded = await ensurePreviewCluster(store, hashPassword, verifyPassword)
  const before = listMessages(store, seeded.botId).length
  expect(readPreviewSeedHead(store)).toEqual({
    statusCode: 302,
    location: `/bots/${seeded.botId}`,
  })
  createBot(store, { name: 'Pantry' })
  expect(readPreviewSeedHead(store).location).toBe(`/bots/${seeded.botId}`)
  expect(listMessages(store, seeded.botId)).toHaveLength(before)

  const other = memoryStore()
  await registerClusterOwner(other, { login: 'ada', password: 'secret-pass' }, hashPassword)
  expect(readPreviewSeedHead(other)).toEqual({ statusCode: 409 })
  expect(listBots(other)).toHaveLength(0)
})

it('treats threads=1 and as=member as the bot-thread demo', () => {
  expect(previewThreadsRequested('1')).toBe(true)
  expect(previewThreadsRequested(1)).toBe(true)
  expect(previewThreadsRequested(undefined)).toBe(false)
  expect(previewThreadAsMember('member')).toBe(true)
  expect(previewThreadAsMember(['member'])).toBe(true)
  expect(previewThreadAsMember('owner')).toBe(false)
  expect(previewThreadAsMember(undefined)).toBe(false)
})

it('seeds a Member private Bot and separate shared bot-threads once', async () => {
  const store = memoryStore()
  const seeded = await ensurePreviewCluster(store, hashPassword, verifyPassword, { threads: true })
  expect(seeded.member?.role).toBe('member')
  expect(seeded.member?.username).toBe(PREVIEW_MEMBER_LOGIN)
  expect(listBots(store).map((bot) => bot.id).sort()).toEqual([PREVIEW_BOT_ID, PREVIEW_PRIVATE_BOT_ID].sort())
  const ownerLines = listBotThreadMessages(store, PREVIEW_BOT_ID, seeded.user.id)
  const memberLines = listBotThreadMessages(store, PREVIEW_BOT_ID, seeded.member!.id)
  expect(ownerLines.some((line) => line.content.startsWith(PREVIEW_OWNER_THREAD_PREFIX))).toBe(true)
  expect(ownerLines.some((line) => line.content.startsWith(PREVIEW_MEMBER_THREAD_PREFIX))).toBe(false)
  expect(memberLines.some((line) => line.content.startsWith(PREVIEW_MEMBER_THREAD_PREFIX))).toBe(true)
  expect(memberLines.some((line) => line.content.startsWith(PREVIEW_OWNER_THREAD_PREFIX))).toBe(false)
  const privateLines = listBotThreadMessages(store, PREVIEW_PRIVATE_BOT_ID, seeded.user.id)
  expect(privateLines.some((line) => line.content.startsWith(PREVIEW_PRIVATE_THREAD_PREFIX))).toBe(false)
  const memberPrivate = listBotThreadMessages(store, PREVIEW_PRIVATE_BOT_ID, seeded.member!.id)
  expect(memberPrivate.some((line) => line.content.startsWith(PREVIEW_PRIVATE_THREAD_PREFIX))).toBe(true)
  const before = listMessages(store, PREVIEW_BOT_ID).length
  await ensurePreviewCluster(store, hashPassword, verifyPassword, { threads: true })
  expect(listMessages(store, PREVIEW_BOT_ID)).toHaveLength(before)
  expect(listBots(store)).toHaveLength(2)
})

it('redirects preview seed the way the live smoke checks', () => {
  const chat = { botId: PREVIEW_BOT_ID, roomId: PREVIEW_ROOM_THREAD_ID }
  expect(previewSeedRedirect(chat)).toBe(`/bots/${PREVIEW_BOT_ID}`)
  expect(previewSeedRedirect({ ...chat, members: '1', activity: 'typing', hold: '1' })).toBe('/members')
  expect(previewSeedRedirect({ ...chat, members: 1, rooms: '1', threads: '1' })).toBe('/members')
  expect(previewSeedRedirect({ ...chat, settings: '1' })).toBe('/settings/providers')
  expect(previewSeedRedirect({ ...chat, settings: 1, activity: 'typing', hold: '1' })).toBe('/settings/providers')
  expect(previewSeedRedirect({ ...chat, providers: '1' })).toBe('/settings/providers')
  expect(previewSeedRedirect({ ...chat, members: '1', providers: '1' })).toBe('/members')
  expect(previewSeedRedirect({ ...chat, members: '1', settings: '1' })).toBe('/members')
  expect(previewSeedRedirect({ ...chat, rooms: '1', as: 'member', activity: 'typing' })).toBe(`/threads/${PREVIEW_ROOM_THREAD_ID}`)
  expect(previewSeedRedirect({ ...chat, rooms: '1', roomId: null })).toBe(`/bots/${PREVIEW_BOT_ID}`)
  expect(previewSeedRedirect({ ...chat, threads: '1' })).toBe('/')
  expect(previewSeedRedirect({ ...chat, threads: '1', as: 'member', activity: 'typing', hold: '1' })).toBe(`/bots/${PREVIEW_BOT_ID}`)
  expect(previewSeedRedirect({ ...chat, activity: 'typing' })).toBe(`/bots/${PREVIEW_BOT_ID}?activity=typing`)
  expect(previewSeedRedirect({ ...chat, hold: '1', activity: 'typing' })).toBe(`/bots/${PREVIEW_BOT_ID}?hold=1&activity=typing`)
  expect(previewSeedRedirect({ ...chat, activity: 'connect', target: 'Expi' })).toBe(`/bots/${PREVIEW_BOT_ID}?activity=connect&target=Expi`)
})

it('treats rooms=1 as the messenger demo', () => {
  expect(previewRoomsRequested('1')).toBe(true)
  expect(previewRoomsRequested(1)).toBe(true)
  expect(previewRoomsRequested(undefined)).toBe(false)
})

it('treats settings=1 as Owner Settings', () => {
  expect(previewSettingsRequested('1')).toBe(true)
  expect(previewSettingsRequested(1)).toBe(true)
  expect(previewSettingsRequested(undefined)).toBe(false)
})

it('seeds the fixture OpenRouter Provider once and only on an empty gateway', () => {
  expect(previewProvidersRequested('1')).toBe(true)
  expect(previewProvidersRequested(undefined)).toBe(false)
  const store = memoryStore()
  ensurePreviewOpenRouterProvider(store)
  ensurePreviewOpenRouterProvider(store)
  const gateway = getLlmGatewaySettings(store)
  expect(gateway.providers).toHaveLength(1)
  expect(gateway.providers?.[0]).toMatchObject({
    id: PREVIEW_OPENROUTER_PROVIDER_ID,
    kind: 'openrouter',
    apiKey: PREVIEW_OPENROUTER_KEY,
  })
  expect(gateway.tierBinds?.strong).toEqual({
    providerId: PREVIEW_OPENROUTER_PROVIDER_ID,
    policy: { kind: 'auto' },
  })
})

it('skips the catalog key probe only for the preview fixture on nuxt dev', () => {
  const open = { dev: true, flag: '1' }
  expect(previewCatalogSkipsKeyProbe({ ...open, providerId: PREVIEW_OPENROUTER_PROVIDER_ID })).toBe(true)
  expect(previewCatalogSkipsKeyProbe({ ...open, providerId: 'or1' })).toBe(false)
  expect(previewCatalogSkipsKeyProbe({ dev: false, flag: '1', providerId: PREVIEW_OPENROUTER_PROVIDER_ID })).toBe(false)
  expect(previewCatalogSkipsKeyProbe({ dev: true, flag: undefined, providerId: PREVIEW_OPENROUTER_PROVIDER_ID })).toBe(false)
})

it('seeds a direct message and a room with one stored mention reply', async () => {
  const store = memoryStore()
  const seeded = await ensurePreviewCluster(store, hashPassword, verifyPassword, { rooms: true })
  expect(seeded.roomId).toBe(PREVIEW_ROOM_THREAD_ID)
  expect(seeded.member?.role).toBe('member')
  const dm = listThreadMessages(store, PREVIEW_DM_THREAD_ID)
  expect(dm.map((line) => line.content)).toEqual([PREVIEW_DM_PREFIX, PREVIEW_DM_REPLY_PREFIX])
  expect(dm[0]?.personId).toBe(seeded.user.id)
  expect(dm[1]?.personId).toBe(seeded.member?.id)
  expect(dm[0]?.botId).toBeNull()
  const room = listThreadMessages(store, PREVIEW_ROOM_THREAD_ID)
  expect(room).toHaveLength(2)
  expect(room[0]?.content.startsWith(PREVIEW_ROOM_PREFIX)).toBe(true)
  expect(mentionedRoomBot(room[0]?.content ?? '', [{ id: PREVIEW_BOT_ID, name: DEFAULT_BOT_NAME }])?.id).toBe(PREVIEW_BOT_ID)
  expect(room[1]?.role).toBe('assistant')
  expect(room[1]?.content).toBe(PREVIEW_ROOM_REPLY_PREFIX)
  expect(room[1]?.botId).toBe(PREVIEW_BOT_ID)
  const before = room.length
  await ensurePreviewCluster(store, hashPassword, verifyPassword, { rooms: true })
  expect(listThreadMessages(store, PREVIEW_ROOM_THREAD_ID)).toHaveLength(before)
  expect(listThreadMessages(store, PREVIEW_DM_THREAD_ID)).toHaveLength(2)
})
