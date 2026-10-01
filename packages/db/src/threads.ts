import type { Bot, BotViewer, CaseStatus, ThreadCase, ThreadListItem, ThreadMark, ThreadParticipantView } from '@dostigus/shared'
import type { ScheduleClock } from './schedules'
import type { OpenedStore } from './store'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import {
  botThreadPersonId,
  CASE_LABEL_MAX,
  CASE_NEXT_ACTION_MAX,
  isCaseStatus,
  isCaseThreadKind,
  isMessengerThreadKind,
  ownerDisplayName,
  THREAD_TITLE_MAX,
} from '@dostigus/shared'
import { authorNameForPerson, getMember, listMembers } from './members'
import { getOwner } from './owners'
import { botThreadIdFor, getBot, insertThreadLine, listBots, requireBot, viewerMaySeeBot } from './queries'
import { zonedWallTimeToUtc } from './schedule-time'
import { effectiveClusterTimeZone } from './schedules'
import { StoreError } from './store-error'

const PEOPLE_MAX = 50
const BOTS_MAX = 20

type ThreadRecord = {
  id: string
  kind: string
  bot_id: string | null
  title: string
  created_at: number
  case_status: string | null
  case_label: string | null
  case_next_action: string | null
  case_follow_up_at: number | null
  case_follow_up_bot_id: string | null
}

const THREAD_SELECT = `
  id, kind, bot_id, title, created_at, case_status, case_label, case_next_action,
  case_follow_up_at, case_follow_up_bot_id
`

export function listHouseholdPeople(store: OpenedStore) {
  const people: { id: string, displayName: string, role: 'owner' | 'member' }[] = []
  const ownerRow = store.sqlite.prepare(`
    SELECT id FROM owners ORDER BY created_at ASC, id ASC LIMIT 1
  `).get() as { id: string } | undefined
  if (ownerRow) {
    const owner = getOwner(store, ownerRow.id)
    if (owner) {
      people.push({
        id: owner.id,
        displayName: ownerDisplayName(owner),
        role: 'owner',
      })
    }
  }
  for (const member of listMembers(store)) {
    if (member.disabledAt) {
      continue
    }
    people.push({
      id: member.id,
      displayName: member.displayName,
      role: 'member',
    })
  }
  return people
}

export type RoomBotAudience = {
  botId: string
  /** Household people who can already open this Bot. Listing does not grant. */
  personIds: string[]
}

/**
 * Bots this person can open, with the Household people who can already
 * open each one. A room create still checks access and does not grant.
 */
export function listRoomBotAudience(store: OpenedStore, viewer: BotViewer): RoomBotAudience[] {
  const people = listHouseholdPeople(store)
  return listBots(store, viewer).map((bot) => ({
    botId: bot.id,
    personIds: people
      .filter((person) => viewerMaySeeBot(store, bot, { id: person.id, role: person.role }))
      .map((person) => person.id),
  }))
}

/**
 * The messenger inbox. `caseStatus: 'open'` keeps only `group` and `room`
 * Threads this person is on whose Case is open (ADR 0044).
 */
export function listInboxThreads(
  store: OpenedStore,
  viewer: BotViewer,
  filter: { caseStatus?: 'open' } = {},
): ThreadListItem[] {
  if (filter.caseStatus === 'open') {
    return listOpenCaseThreads(store, viewer)
  }
  const ids = new Set<string>()
  const joined = store.sqlite.prepare(`
    SELECT thread_id FROM thread_participants
    WHERE kind = 'person' AND ref_id = ?
  `).all(viewer.id) as { thread_id: string }[]
  for (const row of joined) {
    ids.add(row.thread_id)
  }
  for (const bot of listBots(store, viewer)) {
    const threadId = findBotThreadId(store, bot.id, botThreadPersonId(bot, viewer))
    if (threadId) {
      ids.add(threadId)
    }
  }
  const items: ThreadListItem[] = []
  const coveredBots = new Set<string>()
  for (const id of ids) {
    const item = readThreadListItem(store, id, viewer.id)
    if (item) {
      items.push(item)
      if (item.kind === 'bot' && item.botId) {
        coveredBots.add(item.botId)
      }
    }
  }
  for (const bot of listBots(store, viewer)) {
    if (coveredBots.has(bot.id)) {
      continue
    }
    items.push(botInboxRow(store, bot, viewer.id))
  }
  items.sort(byActivity)
  return items
}

function listOpenCaseThreads(store: OpenedStore, viewer: BotViewer): ThreadListItem[] {
  const rows = store.sqlite.prepare(`
    SELECT t.id AS id
    FROM threads t
    INNER JOIN thread_participants p
      ON p.thread_id = t.id AND p.kind = 'person' AND p.ref_id = ?
    WHERE t.kind IN ('group', 'room') AND t.case_status = 'open'
  `).all(viewer.id) as { id: string }[]
  const items: ThreadListItem[] = []
  for (const row of rows) {
    const item = readThreadListItem(store, row.id, viewer.id)
    if (item?.case?.status === 'open') {
      items.push(item)
    }
  }
  items.sort(byActivity)
  return items
}

function byActivity(a: ThreadListItem, b: ThreadListItem): number {
  return activityMs(b) - activityMs(a) || b.createdAt.localeCompare(a.createdAt)
}

export function getMessengerThread(
  store: OpenedStore,
  threadId: string,
  personId: string,
): ThreadListItem {
  const item = readThreadListItem(store, threadId, personId)
  if (!item || !isMessengerThreadKind(item.kind) || !isPersonParticipant(store, threadId, personId)) {
    throw new StoreError('Thread not found', 404)
  }
  return item
}

export function createMessengerThread(
  store: OpenedStore,
  input: {
    kind: string
    title?: string
    actorId: string
    personIds?: string[]
    botIds?: string[]
    /** Fixture id. A second create with the same id returns that Thread. */
    id?: string
  },
): ThreadListItem {
  if (!isMessengerThreadKind(input.kind)) {
    throw new StoreError('Unknown Thread kind', 400)
  }
  const kind = input.kind
  const actor = personViewer(store, input.actorId)
  const personIds = uniqueIds([...(input.personIds ?? []), actor.id])
  if (personIds.length > PEOPLE_MAX) {
    throw new StoreError('Too many people', 400)
  }
  for (const personId of personIds) {
    personViewer(store, personId)
  }
  const botIds = uniqueIds(input.botIds ?? [])
  if (botIds.length > BOTS_MAX) {
    throw new StoreError('Too many Bots', 400)
  }

  if (kind === 'dm') {
    if (personIds.length !== 2) {
      throw new StoreError('A direct message is one person and another person', 400)
    }
    if (botIds.length > 0) {
      throw new StoreError('A direct message is only people', 400)
    }
  } else if (kind === 'group') {
    if (personIds.length < 2) {
      throw new StoreError('A group needs at least two people', 400)
    }
    if (botIds.length > 0) {
      throw new StoreError('A group is only people', 400)
    }
  } else {
    if (personIds.length < 2) {
      throw new StoreError('A room needs at least two people', 400)
    }
    if (botIds.length < 1) {
      throw new StoreError('A room needs a Bot', 400)
    }
  }

  const title = kind === 'dm' ? '' : normalizeThreadTitle(input.title)
  const bots = botIds.map((id) => requireBot(store, id))
  if (kind === 'room') {
    assertRoomBots(store, bots, personIds)
  }

  const explicitId = input.id === undefined ? null : normalizeThreadId(input.id)
  if (explicitId) {
    const existing = selectThread(store, explicitId)
    if (existing) {
      if (existing.kind !== kind || !isPersonParticipant(store, existing.id, actor.id)) {
        throw new StoreError('Thread not found', 404)
      }
      return requireListItem(store, existing.id, actor.id)
    }
  } else if (kind === 'dm') {
    const otherId = personIds.find((id) => id !== actor.id)
    const existingId = otherId ? findDm(store, actor.id, otherId) : null
    if (existingId) {
      return requireListItem(store, existingId, actor.id)
    }
  }

  const id = explicitId ?? randomUUID()
  const createdAt = Date.now()
  store.sqlite.exec('BEGIN')
  try {
    store.sqlite.prepare(`
      INSERT INTO threads (id, kind, bot_id, title, created_at) VALUES (?, ?, NULL, ?, ?)
    `).run(id, kind, title, createdAt)
    const insertParticipant = store.sqlite.prepare(`
      INSERT INTO thread_participants (thread_id, kind, ref_id) VALUES (?, ?, ?)
    `)
    for (const personId of personIds) {
      insertParticipant.run(id, 'person', personId)
    }
    for (const botId of botIds) {
      insertParticipant.run(id, 'bot', botId)
    }
    store.sqlite.exec('COMMIT')
  } catch (error) {
    store.sqlite.exec('ROLLBACK')
    const again = selectThread(store, id)
    if (again && isPersonParticipant(store, again.id, actor.id)) {
      return requireListItem(store, again.id, actor.id)
    }
    throw error
  }
  return requireListItem(store, id, actor.id)
}

/**
 * Adds one person or one Bot to a `group` or `room` after create. A `dm`
 * does not grow. A Bot joins only when every person participant can
 * already open it; a person joins a `room` only when they can already open
 * every Bot on it. Neither add writes `bot_grants`. The first Bot on a
 * `group` makes it a `room`.
 */
export function addMessengerParticipant(
  store: OpenedStore,
  input: { threadId: string, actorId: string, kind: string, id: string },
): ThreadListItem {
  const current = getMessengerThread(store, input.threadId, input.actorId)
  if (current.kind === 'dm') {
    throw new StoreError('A direct message does not take more people or Bots', 400)
  }
  const refId = input.id.trim()
  const people = current.participants.filter((participant) => participant.kind === 'person')
  const botParticipants = current.participants.filter((participant) => participant.kind === 'bot')
  let nextKind = current.kind

  if (input.kind === 'person') {
    const viewer = personViewer(store, refId)
    if (people.some((person) => person.id === viewer.id)) {
      throw new StoreError('Already in this Thread', 409)
    }
    if (people.length + 1 > PEOPLE_MAX) {
      throw new StoreError('Too many people', 400)
    }
    for (const participant of botParticipants) {
      const bot = getBot(store, participant.id)
      if (bot && !viewerMaySeeBot(store, bot, viewer)) {
        throw new StoreError('Every person in the room must already have access to that Bot', 400)
      }
    }
  } else if (input.kind === 'bot') {
    const bot = requireBot(store, refId)
    if (botParticipants.some((participant) => participant.id === bot.id)) {
      throw new StoreError('Already in this Thread', 409)
    }
    if (botParticipants.length + 1 > BOTS_MAX) {
      throw new StoreError('Too many Bots', 400)
    }
    assertRoomBots(store, [bot], people.map((person) => person.id))
    nextKind = 'room'
  } else {
    throw new StoreError('Add a person or a Bot', 400)
  }

  store.sqlite.exec('BEGIN')
  try {
    store.sqlite.prepare(`
      INSERT INTO thread_participants (thread_id, kind, ref_id) VALUES (?, ?, ?)
    `).run(current.id, input.kind, refId)
    if (nextKind !== current.kind) {
      store.sqlite.prepare('UPDATE threads SET kind = ? WHERE id = ?').run(nextKind, current.id)
    }
    store.sqlite.exec('COMMIT')
  } catch (error) {
    store.sqlite.exec('ROLLBACK')
    throw error
  }
  return requireListItem(store, current.id, input.actorId)
}

/**
 * Writes the Case on a `group` or `room` (ADR 0041, ADR 0044). Any person
 * participant may write. The first write creates the Case with status
 * `open` unless the body sets it. A `dm` or bot-thread is not found.
 *
 * `followUpAt` is an ISO instant with an offset, or a `YYYY-MM-DDTHH:MM`
 * wall clock in the Cluster timezone. It needs `followUpBotId`, a Bot
 * Participant. `null` clears both. `done` clears both.
 */
export function updateThreadCase(
  store: OpenedStore,
  input: {
    threadId: string
    actorId: string
    status?: unknown
    label?: unknown
    nextAction?: unknown
    followUpAt?: unknown
    followUpBotId?: unknown
  },
  clock?: ScheduleClock,
): ThreadListItem {
  const current = getMessengerThread(store, input.threadId, input.actorId)
  if (!isCaseThreadKind(current.kind)) {
    throw new StoreError('Thread not found', 404)
  }
  if (
    input.status === undefined
    && input.label === undefined
    && input.nextAction === undefined
    && input.followUpAt === undefined
    && input.followUpBotId === undefined
  ) {
    throw new StoreError('Send a Case status, label, next action, or follow-up', 400)
  }
  if (input.status !== undefined && !isCaseStatus(input.status)) {
    throw new StoreError('Case status must be open or done', 400)
  }
  const label = caseText(input.label, CASE_LABEL_MAX, `Case label must be ${CASE_LABEL_MAX} characters or fewer`)
  const nextAction = caseText(
    input.nextAction,
    CASE_NEXT_ACTION_MAX,
    `Case next action must be ${CASE_NEXT_ACTION_MAX} characters or fewer`,
  )
  const status = input.status ?? current.case?.status ?? 'open'
  const followUp = resolveFollowUp(store, current, status, input, clock)
  store.sqlite.prepare(`
    UPDATE threads
    SET case_status = ?,
      case_label = COALESCE(?, case_label, ''),
      case_next_action = COALESCE(?, case_next_action, ''),
      case_follow_up_at = ?,
      case_follow_up_bot_id = ?
    WHERE id = ?
  `).run(status, label ?? null, nextAction ?? null, followUp.at, followUp.botId, current.id)
  return requireListItem(store, current.id, input.actorId)
}

function resolveFollowUp(
  store: OpenedStore,
  current: ThreadListItem,
  status: CaseStatus,
  input: { followUpAt?: unknown, followUpBotId?: unknown },
  clock?: ScheduleClock,
): { at: number | null, botId: string | null } {
  const atGiven = input.followUpAt !== undefined
  const botGiven = input.followUpBotId !== undefined
  const at = atGiven
    ? parseFollowUpAt(store, input.followUpAt, clock)
    : current.case?.followUpAt ? Date.parse(current.case.followUpAt) : null
  const botId = botGiven ? followUpBotIdOf(input.followUpBotId) : current.case?.followUpBotId ?? null
  if (status === 'done') {
    if (atGiven && at != null) {
      throw new StoreError('A done Case has no follow-up', 400)
    }
    return { at: null, botId: null }
  }
  if (at == null) {
    if (botGiven && botId && !atGiven) {
      throw new StoreError('Set a follow-up time', 400)
    }
    return { at: null, botId: null }
  }
  if (!botId) {
    throw new StoreError('Pick a Bot for the follow-up', 400)
  }
  if ((atGiven || botGiven) && !current.participants.some((item) => item.kind === 'bot' && item.id === botId)) {
    throw new StoreError('The follow-up Bot must be in this Thread', 400)
  }
  if (atGiven && at <= (clock?.now ?? Date.now())) {
    throw new StoreError('Follow-up time must be in the future', 400)
  }
  return { at, botId }
}

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const WITH_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i

function parseFollowUpAt(store: OpenedStore, value: unknown, clock?: ScheduleClock): number | null {
  if (value === null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    throw new StoreError('Follow-up time must be a date and time', 400)
  }
  const text = value.trim()
  const wall = WALL_CLOCK.exec(text)
  if (wall) {
    const [year, month, day, hour, minute] = wall.slice(1).map(Number) as [number, number, number, number, number]
    const check = new Date(Date.UTC(year, month - 1, day, hour, minute))
    if (
      check.getUTCFullYear() !== year
      || check.getUTCMonth() !== month - 1
      || check.getUTCDate() !== day
      || check.getUTCHours() !== hour
      || check.getUTCMinutes() !== minute
    ) {
      throw new StoreError('Follow-up time must be a date and time', 400)
    }
    const timeZone = effectiveClusterTimeZone(store, clock?.env ?? process.env).effective
    return zonedWallTimeToUtc(year, month, day, hour, minute, timeZone)
  }
  const ms = WITH_OFFSET.test(text) ? Date.parse(text) : Number.NaN
  if (!Number.isFinite(ms)) {
    throw new StoreError('Follow-up time must be a date and time', 400)
  }
  return ms
}

function followUpBotIdOf(value: unknown): string | null {
  if (value === null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    throw new StoreError('Follow-up Bot must be a Bot id', 400)
  }
  return value.trim() || null
}

/** A `group` or `room` whose Case follow-up is due. See ADR 0044. */
export type DueCaseFollowUp = {
  threadId: string
  botId: string
  followUpAt: number
}

export function listDueCaseFollowUps(store: OpenedStore, now: number): DueCaseFollowUp[] {
  const rows = store.sqlite.prepare(`
    SELECT id, case_follow_up_at, case_follow_up_bot_id
    FROM threads
    WHERE case_follow_up_at IS NOT NULL AND case_follow_up_at <= ?
    ORDER BY case_follow_up_at ASC, id ASC
  `).all(now) as { id: string, case_follow_up_at: number, case_follow_up_bot_id: string | null }[]
  return rows.map((row) => ({
    threadId: row.id,
    botId: row.case_follow_up_bot_id ?? '',
    followUpAt: row.case_follow_up_at,
  }))
}

export type CaseFollowUpClaim
  = | { outcome: 'gone' }
    | { outcome: 'skipped_done' | 'skipped_bot' }
    | {
      outcome: 'fire'
      threadId: string
      botId: string
      /** The person the Bot turn runs for: the first person Participant. */
      personId: string
      title: string
      label: string
      nextAction: string
    }

/**
 * Clears a due follow-up once and says whether to fire it. A `done` Case
 * or a Bot that left the Thread skips. The Case stays as it was.
 */
export function claimCaseFollowUp(store: OpenedStore, due: DueCaseFollowUp): CaseFollowUpClaim {
  const claimed = store.sqlite.prepare(`
    UPDATE threads SET case_follow_up_at = NULL, case_follow_up_bot_id = NULL
    WHERE id = ? AND case_follow_up_at = ?
  `).run(due.threadId, due.followUpAt)
  if (Number(claimed.changes) === 0) {
    return { outcome: 'gone' }
  }
  const thread = selectThread(store, due.threadId)
  if (!thread || !isCaseThreadKind(thread.kind)) {
    return { outcome: 'gone' }
  }
  if (thread.case_status !== 'open') {
    return { outcome: 'skipped_done' }
  }
  const onThread = store.sqlite.prepare(`
    SELECT 1 AS ok FROM thread_participants
    WHERE thread_id = ? AND kind = 'bot' AND ref_id = ?
  `).get(thread.id, due.botId) as { ok: number } | undefined
  if (!due.botId || !onThread || !getBot(store, due.botId)) {
    return { outcome: 'skipped_bot' }
  }
  const person = store.sqlite.prepare(`
    SELECT ref_id FROM thread_participants
    WHERE thread_id = ? AND kind = 'person'
    ORDER BY rowid ASC
    LIMIT 1
  `).get(thread.id) as { ref_id: string } | undefined
  if (!person) {
    return { outcome: 'skipped_bot' }
  }
  return {
    outcome: 'fire',
    threadId: thread.id,
    botId: due.botId,
    personId: person.ref_id,
    title: thread.title,
    label: thread.case_label ?? '',
    nextAction: thread.case_next_action ?? '',
  }
}

function caseText(value: unknown, max: number, tooLong: string): string | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw new StoreError('Case label and next action are text', 400)
  }
  const trimmed = value.trim()
  if (trimmed.length > max) {
    throw new StoreError(tooLong, 400)
  }
  return trimmed
}

export function listMessengerBots(store: OpenedStore, threadId: string, personId: string): Bot[] {
  getMessengerThread(store, threadId, personId)
  const rows = store.sqlite.prepare(`
    SELECT ref_id FROM thread_participants
    WHERE thread_id = ? AND kind = 'bot'
    ORDER BY ref_id ASC
  `).all(threadId) as { ref_id: string }[]
  const bots: Bot[] = []
  for (const row of rows) {
    const bot = getBot(store, row.ref_id)
    if (bot) {
      bots.push(bot)
    }
  }
  return bots
}

export function appendMessengerUserLine(
  store: OpenedStore,
  input: { threadId: string, personId: string, content: string, allowEmpty?: boolean },
) {
  getMessengerThread(store, input.threadId, input.personId)
  return insertThreadLine(store, {
    threadId: input.threadId,
    role: 'user',
    content: input.content,
    personId: input.personId,
    botId: null,
    allowEmpty: input.allowEmpty === true,
  })
}

export function appendMessengerAssistantLine(
  store: OpenedStore,
  input: { threadId: string, botId: string, content: string, parts?: unknown },
) {
  const bot = requireBot(store, input.botId)
  const participant = store.sqlite.prepare(`
    SELECT 1 AS ok FROM thread_participants
    WHERE thread_id = ? AND kind = 'bot' AND ref_id = ?
  `).get(input.threadId, bot.id) as { ok: number } | undefined
  if (!participant) {
    throw new StoreError('That Bot is not in this room', 400)
  }
  return insertThreadLine(store, {
    threadId: input.threadId,
    role: 'assistant',
    content: input.content,
    personId: null,
    botId: bot.id,
    parts: input.parts,
  })
}

function assertRoomBots(store: OpenedStore, bots: Bot[], personIds: string[]) {
  const viewers = personIds.map((id) => personViewer(store, id))
  for (const bot of bots) {
    for (const viewer of viewers) {
      if (!viewerMaySeeBot(store, bot, viewer)) {
        throw new StoreError('Every person in the room must already have access to that Bot', 400)
      }
    }
  }
}

function personViewer(store: OpenedStore, personId: string): BotViewer {
  if (getOwner(store, personId)) {
    return { id: personId, role: 'owner' }
  }
  const member = getMember(store, personId)
  if (!member || member.disabledAt) {
    throw new StoreError('That person is not in this Collective', 400)
  }
  return { id: personId, role: 'member' }
}

function normalizeThreadTitle(value: string | undefined): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    throw new StoreError('Name this Thread', 400)
  }
  if (trimmed.length > THREAD_TITLE_MAX) {
    throw new StoreError(`Thread name must be ${THREAD_TITLE_MAX} characters or fewer`, 400)
  }
  return trimmed
}

function normalizeThreadId(id: string): string {
  const trimmed = id.trim()
  if (!/^[\w-]{1,64}$/.test(trimmed)) {
    throw new StoreError('Thread id must be 1–64 letters, digits, _ or -', 400)
  }
  return trimmed
}

function uniqueIds(values: string[]): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const id = value.trim()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function selectThread(store: OpenedStore, id: string): ThreadRecord | undefined {
  return store.sqlite.prepare(`
    SELECT ${THREAD_SELECT}
    FROM threads WHERE id = ?
  `).get(id) as ThreadRecord | undefined
}

function findDm(store: OpenedStore, a: string, b: string): string | null {
  const row = store.sqlite.prepare(`
    SELECT t.id AS id
    FROM threads t
    WHERE t.kind = 'dm'
      AND (
        SELECT count(*) FROM thread_participants p
        WHERE p.thread_id = t.id AND p.kind = 'person'
      ) = 2
      AND NOT EXISTS (
        SELECT 1 FROM thread_participants p
        WHERE p.thread_id = t.id AND p.kind = 'bot'
      )
      AND EXISTS (
        SELECT 1 FROM thread_participants p
        WHERE p.thread_id = t.id AND p.kind = 'person' AND p.ref_id = ?
      )
      AND EXISTS (
        SELECT 1 FROM thread_participants p
        WHERE p.thread_id = t.id AND p.kind = 'person' AND p.ref_id = ?
      )
    ORDER BY t.created_at ASC, t.id ASC
    LIMIT 1
  `).get(a, b) as { id: string } | undefined
  return row?.id ?? null
}

function findBotThreadId(store: OpenedStore, botId: string, personId: string): string | null {
  const row = store.sqlite.prepare(`
    SELECT t.id AS id
    FROM threads t
    INNER JOIN thread_participants person
      ON person.thread_id = t.id AND person.kind = 'person' AND person.ref_id = ?
    INNER JOIN thread_participants bot
      ON bot.thread_id = t.id AND bot.kind = 'bot' AND bot.ref_id = ?
    WHERE t.kind = 'bot'
    LIMIT 1
  `).get(personId, botId) as { id: string } | undefined
  return row?.id ?? null
}

function isPersonParticipant(store: OpenedStore, threadId: string, personId: string): boolean {
  const row = store.sqlite.prepare(`
    SELECT 1 AS ok FROM thread_participants
    WHERE thread_id = ? AND kind = 'person' AND ref_id = ?
  `).get(threadId, personId) as { ok: number } | undefined
  return Boolean(row)
}

function requireListItem(store: OpenedStore, threadId: string, viewerId: string): ThreadListItem {
  const item = readThreadListItem(store, threadId, viewerId)
  if (!item) {
    throw new StoreError('Thread not found', 404)
  }
  return item
}

function readThreadListItem(
  store: OpenedStore,
  threadId: string,
  viewerId: string,
): ThreadListItem | null {
  const thread = selectThread(store, threadId)
  if (!thread || !isThreadKindLoose(thread.kind)) {
    return null
  }
  const participants = loadParticipants(store, threadId)
  const bot = thread.bot_id ? getBot(store, thread.bot_id) : undefined
  const title = titleFor(thread, participants, viewerId, bot?.name)
  const mark = markFor(thread, participants, viewerId, bot)
  const kind = thread.kind
  return {
    id: thread.id,
    kind,
    title,
    botId: thread.bot_id,
    href: kind === 'bot' && thread.bot_id ? `/bots/${thread.bot_id}` : `/threads/${thread.id}`,
    createdAt: new Date(thread.created_at).toISOString(),
    lastMessage: lastMessage(store, thread.id),
    participants,
    mark,
    case: caseFor(thread),
  }
}

function caseFor(thread: ThreadRecord): ThreadCase | null {
  if (!isCaseThreadKind(thread.kind) || !isCaseStatus(thread.case_status)) {
    return null
  }
  return {
    status: thread.case_status,
    label: thread.case_label ?? '',
    nextAction: thread.case_next_action ?? '',
    followUpAt: thread.case_follow_up_at == null ? null : new Date(thread.case_follow_up_at).toISOString(),
    followUpBotId: thread.case_follow_up_at == null ? null : thread.case_follow_up_bot_id,
  }
}

function isThreadKindLoose(kind: string): kind is ThreadListItem['kind'] {
  return kind === 'dm' || kind === 'group' || kind === 'bot' || kind === 'room'
}

function loadParticipants(store: OpenedStore, threadId: string): ThreadParticipantView[] {
  const rows = store.sqlite.prepare(`
    SELECT kind, ref_id FROM thread_participants
    WHERE thread_id = ?
    ORDER BY kind ASC, ref_id ASC
  `).all(threadId) as { kind: string, ref_id: string }[]
  const views: ThreadParticipantView[] = []
  for (const row of rows) {
    if (row.kind === 'bot') {
      const bot = getBot(store, row.ref_id)
      views.push({
        kind: 'bot',
        id: row.ref_id,
        name: bot?.name ?? 'Bot',
        avatarShape: bot?.manifest.avatarShape,
        avatarColor: bot?.manifest.avatarColor,
      })
      continue
    }
    if (row.kind === 'person') {
      views.push({
        kind: 'person',
        id: row.ref_id,
        name: authorNameForPerson(store, row.ref_id) ?? 'Someone',
      })
    }
  }
  return views
}

function titleFor(
  thread: ThreadRecord,
  participants: ThreadParticipantView[],
  viewerId: string,
  botName: string | undefined,
): string {
  if (thread.kind === 'bot') {
    return botName || 'Bot'
  }
  if (thread.kind === 'dm') {
    return otherPerson(participants, viewerId)?.name ?? 'Direct message'
  }
  return thread.title || (thread.kind === 'room' ? 'Room' : 'Group')
}

function markFor(
  thread: ThreadRecord,
  participants: ThreadParticipantView[],
  viewerId: string,
  bot: Bot | undefined,
): ThreadMark {
  if (thread.kind === 'bot' && bot) {
    return {
      type: 'bot',
      name: bot.name,
      seed: bot.id,
      shape: bot.manifest.avatarShape,
      color: bot.manifest.avatarColor,
    }
  }
  if (thread.kind === 'dm') {
    const other = otherPerson(participants, viewerId)
    return {
      type: 'initials',
      name: other?.name ?? 'Direct message',
      seed: other?.id ?? thread.id,
    }
  }
  const name = thread.title || (thread.kind === 'room' ? 'Room' : 'Group')
  return { type: 'initials', name, seed: thread.id }
}

function otherPerson(participants: ThreadParticipantView[], viewerId: string) {
  return participants.find((person) => person.kind === 'person' && person.id !== viewerId)
    ?? participants.find((person) => person.kind === 'person')
}

function lastMessage(store: OpenedStore, threadId: string): ThreadListItem['lastMessage'] {
  const row = store.sqlite.prepare(`
    SELECT id, content, created_at FROM messages
    WHERE thread_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `).get(threadId) as { id: string, content: string, created_at: number } | undefined
  if (!row) {
    return null
  }
  const oneLine = row.content.replace(/\s+/g, ' ').trim() || artifactFilenames(store, row.id)
  const content = oneLine.length <= 140 ? oneLine : `${oneLine.slice(0, 139)}…`
  return {
    content,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

/** Preview for a line with no text: the joined Artifact filenames, in join order. */
function artifactFilenames(store: OpenedStore, messageId: string): string {
  const rows = store.sqlite.prepare(`
    SELECT artifacts.filename AS filename
    FROM message_artifacts
    JOIN artifacts ON artifacts.id = message_artifacts.artifact_id
    WHERE message_artifacts.message_id = ?
    ORDER BY message_artifacts.created_at, message_artifacts.rowid
  `).all(messageId) as { filename: string }[]
  return rows.map((row) => row.filename.replace(/\s+/g, ' ').trim()).filter(Boolean).join(', ')
}

function activityMs(item: ThreadListItem): number {
  if (item.lastMessage) {
    return Date.parse(item.lastMessage.createdAt)
  }
  return Date.parse(item.createdAt)
}

/** A Bot this person can open before their bot-thread exists. First open writes the greeting. */
function botInboxRow(store: OpenedStore, bot: Bot, viewerId: string): ThreadListItem {
  return {
    id: botThreadIdFor(bot.id, viewerId),
    kind: 'bot',
    title: bot.name,
    botId: bot.id,
    href: `/bots/${bot.id}`,
    createdAt: bot.createdAt,
    lastMessage: null,
    participants: [
      {
        kind: 'person',
        id: viewerId,
        name: authorNameForPerson(store, viewerId) ?? 'Someone',
      },
      {
        kind: 'bot',
        id: bot.id,
        name: bot.name,
        avatarShape: bot.manifest.avatarShape,
        avatarColor: bot.manifest.avatarColor,
      },
    ],
    mark: {
      type: 'bot',
      name: bot.name,
      seed: bot.id,
      shape: bot.manifest.avatarShape,
      color: bot.manifest.avatarColor,
    },
    case: null,
  }
}
