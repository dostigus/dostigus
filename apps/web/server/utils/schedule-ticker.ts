import type { OpenedStore } from '@dostigus/db'
import process from 'node:process'
import {
  decideScheduleFire,
  getBot,
  getLlmGatewaySettings,
  insertMessage,
  listBotSkills,
  listBotThreadMessages,
  listDueSchedules,
  listThreadMessages,
  openBotThread,
  personMayOpenBot,
  recordScheduleDefer,
  recordScheduleFire,
  recordScheduleSkip,
  SCHEDULE_CATCH_UP_MS,
  SCHEDULE_TICK_MS,
  viewerForPerson,
} from '@dostigus/db'
import { annotateHistoryWithArtifacts, attachTurnArtifacts, gcArtifacts } from './artifacts'
import {
  clearChatActivityPhase,
  readChatActivityPhase,
  setChatActivityPhase,
} from './chat-activity-phase'
import { openChatTurn } from './chat-turn'
import { completeAssistantReply, gatewayErrorReply } from './llm'
import {
  beginChatTurn,
  recordChatTurnTool,
  settleChatTurn,
  settleFromReply,
} from './turn-journal'

type ReplyFn = typeof completeAssistantReply

const wakes = new Set<Promise<void>>()
let timer: ReturnType<typeof setInterval> | undefined
let ticking = false

export function startScheduleTicker(): void {
  if (timer) {
    return
  }
  timer = setInterval(() => {
    try {
      runScheduleTick()
    } catch (error) {
      console.warn('Schedule tick failed', error)
    }
  }, SCHEDULE_TICK_MS)
  timer.unref()
}

export function stopScheduleTicker(): void {
  if (!timer) {
    return
  }
  clearInterval(timer)
  timer = undefined
}

export function flushScheduleWakes(): Promise<void> {
  return Promise.all([...wakes]).then(() => undefined)
}

export function runScheduleTick(input: {
  store?: OpenedStore
  now?: number
  env?: NodeJS.ProcessEnv
  completeReply?: ReplyFn
} = {}): void {
  if (ticking) {
    return
  }
  ticking = true
  try {
    const store = input.store ?? useStore()
    const now = input.now ?? Date.now()
    const env = input.env ?? process.env
    const completeReply = input.completeReply ?? completeAssistantReply
    try {
      gcArtifacts(store, { now })
    } catch (error) {
      console.warn('Artifact GC failed', error)
    }
    for (const schedule of listDueSchedules(store, now)) {
      try {
        dispatchSchedule({
          store,
          now,
          env,
          completeReply,
          schedule,
        })
      } catch (error) {
        console.warn(`Schedule ${schedule.id} failed`, error)
      }
    }
  } finally {
    ticking = false
  }
}

function dispatchSchedule(input: {
  store: OpenedStore
  now: number
  env: NodeJS.ProcessEnv
  completeReply: ReplyFn
  schedule: ReturnType<typeof listDueSchedules>[number]
}): void {
  const { store, now, env, schedule } = input
  const within = now - schedule.plannedAt < SCHEDULE_CATCH_UP_MS
  const hasAccess = personMayOpenBot(store, schedule.botId, schedule.personId)
  let busy = false
  let threadId: string | null = null
  if (within && hasAccess) {
    threadId = openBotThread(store, schedule.botId, schedule.personId)
    busy = readChatActivityPhase(threadId, schedule.botId) != null
  }
  const decision = decideScheduleFire({
    now,
    plannedAt: schedule.plannedAt,
    deferCount: schedule.deferCount,
    hasAccess,
    busy,
  })
  if (decision === 'wait_access') {
    console.warn(`Schedule ${schedule.id} wait_access`)
    return
  }
  if (decision === 'defer') {
    recordScheduleDefer(store, schedule.id, now)
    console.warn(`Schedule ${schedule.id} deferred`)
    return
  }
  if (decision === 'skip_late' || decision === 'skip_busy') {
    recordScheduleSkip(
      store,
      schedule.id,
      decision === 'skip_late' ? 'skipped_late' : 'skipped_busy',
      { now, env },
    )
    console.warn(`Schedule ${schedule.id} ${decision}`)
    return
  }
  if (!threadId) {
    throw new Error('Schedule fire is missing a bot-thread')
  }
  beginWake({
    store,
    now,
    env,
    completeReply: input.completeReply,
    scheduleId: schedule.id,
    botId: schedule.botId,
    personId: schedule.personId,
    wakeText: schedule.wakeText,
    threadId,
  })
}

function beginWake(input: {
  store: OpenedStore
  now: number
  env: NodeJS.ProcessEnv
  completeReply: ReplyFn
  scheduleId: string
  botId: string
  personId: string
  wakeText: string
  threadId: string
}): void {
  const viewer = viewerForPerson(input.store, input.personId)
  listBotThreadMessages(input.store, input.botId, input.personId)
  insertMessage(input.store, {
    botId: input.botId,
    role: 'system',
    content: input.wakeText,
    threadId: input.threadId,
    viewer,
  })
  recordScheduleFire(input.store, input.scheduleId, { now: input.now, env: input.env })
  const turnId = beginChatTurn(input.store, {
    threadId: input.threadId,
    botId: input.botId,
    personId: input.personId,
    trigger: 'wake',
    scheduleId: input.scheduleId,
  })
  setChatActivityPhase(input.threadId, input.botId, 'thinking')
  console.warn(`Schedule ${input.scheduleId} fired`)
  const task = finishWake(input, viewer.role, turnId).finally(() => {
    clearChatActivityPhase(input.threadId, input.botId)
  })
  wakes.add(task)
  void task.finally(() => {
    wakes.delete(task)
  })
}

async function finishWake(
  input: {
    store: OpenedStore
    env: NodeJS.ProcessEnv
    completeReply: ReplyFn
    botId: string
    personId: string
    threadId: string
  },
  role: 'owner' | 'member',
  turnId: string,
): Promise<void> {
  const bot = getBot(input.store, input.botId)
  if (!bot) {
    settleChatTurn(input.store, turnId, { outcome: 'error', errorCode: null })
    return
  }
  const viewer = viewerForPerson(input.store, input.personId)
  const turn = openChatTurn({
    store: input.store,
    role,
    canEditManifest: false,
    personId: input.personId,
    turnBotId: input.botId,
    wake: true,
  })
  let content: string
  let settle = settleFromReply({ via: 'error' })
  try {
    const reply = await input.completeReply({
      botName: bot.name,
      botId: bot.id,
      modelTier: bot.manifest.modelTier,
      history: annotateHistoryWithArtifacts(listThreadMessages(input.store, input.threadId)),
      manifest: bot.manifest,
      skills: listBotSkills(input.store, bot.id),
      env: input.env,
      stored: getLlmGatewaySettings(input.store),
      audience: role,
      wake: true,
      tools: turn.tools(),
      invokeTool: turn.invokeTool,
      onActivity: (phase) => {
        setChatActivityPhase(input.threadId, input.botId, phase)
      },
      onTool: (entry) => {
        recordChatTurnTool(input.threadId, input.botId, entry)
      },
    })
    content = reply.content
    settle = settleFromReply({ via: reply.via })
  } catch (error) {
    console.warn(`Schedule wake failed for Bot ${input.botId}`)
    content = gatewayErrorReply(role)
    settle = settleFromReply({ error })
  }
  try {
    const assistant = insertMessage(input.store, {
      botId: input.botId,
      role: 'assistant',
      content,
      parts: turn.cards.parts(),
      threadId: input.threadId,
      viewer,
    })
    if (turn.artifacts.ids.length > 0) {
      attachTurnArtifacts(input.store, assistant.id, turn.artifacts.ids)
    }
    settleChatTurn(input.store, turnId, settle)
  } catch (error) {
    settleChatTurn(input.store, turnId, settleFromReply({ error }))
    throw error
  }
}
