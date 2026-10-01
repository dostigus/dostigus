import type { OpenedStore } from '@dostigus/db'
import {
  appendMessengerAssistantLine,
  authorNameForPerson,
  claimCaseFollowUp,
  getBot,
  getLlmGatewaySettings,
  getMember,
  insertThreadLine,
  listBotSkills,
  listDueCaseFollowUps,
  listThreadMessages,
  viewerForPerson,
} from '@dostigus/db'
import { caseFollowUpLine, caseFollowUpWakeText } from '@dostigus/shared'
import { resolveHostLocale } from '@dostigus/ui-kit/locale'
import { annotateHistoryWithArtifacts, attachTurnArtifacts } from './artifacts'
import {
  clearChatActivityPhase,
  readChatActivityPhase,
  setChatActivityPhase,
} from './chat-activity-phase'
import { openChatTurn } from './chat-turn'
import { completeAssistantReply, gatewayErrorReply } from './llm'
import {
  beginChatTurn,
  noteChatTurnObservability,
  noteChatTurnUsage,
  recordChatTurnTool,
  settleChatTurn,
  settleFromReply,
} from './turn-journal'
import { applyWakePromptToHistory } from './wake-history'

type ReplyFn = typeof completeAssistantReply

type CaseWake = {
  store: OpenedStore
  env: NodeJS.ProcessEnv
  completeReply: ReplyFn
  threadId: string
  botId: string
  personId: string
  wakeText: string
}

const caseWakes = new Set<Promise<void>>()

export function flushCaseFollowUpWakes(): Promise<void> {
  return Promise.all([...caseWakes]).then(() => undefined)
}

/**
 * Case follow-up Wakes on a `group` or `room` (ADR 0044). A sibling to
 * Schedule fire, not a Schedule row. One-shot: a due follow-up is cleared
 * before the turn starts. A busy Bot on that Thread waits for the next tick.
 */
export function runCaseFollowUps(input: {
  store: OpenedStore
  now: number
  env: NodeJS.ProcessEnv
  completeReply?: ReplyFn
}): void {
  const completeReply = input.completeReply ?? completeAssistantReply
  for (const due of listDueCaseFollowUps(input.store, input.now)) {
    try {
      if (due.botId && readChatActivityPhase(due.threadId, due.botId) != null) {
        continue
      }
      const claim = claimCaseFollowUp(input.store, due)
      if (claim.outcome !== 'fire') {
        if (claim.outcome !== 'gone') {
          console.warn(`Case follow-up on Thread ${due.threadId} ${claim.outcome}`)
        }
        continue
      }
      insertThreadLine(input.store, {
        threadId: claim.threadId,
        role: 'system',
        content: caseFollowUpLine({ label: claim.label, title: claim.title }),
        botId: claim.botId,
      })
      const turnId = beginChatTurn(input.store, {
        threadId: claim.threadId,
        botId: claim.botId,
        personId: claim.personId,
        trigger: 'wake',
        now: input.now,
      })
      setChatActivityPhase(claim.threadId, claim.botId, 'thinking')
      console.warn(`Case follow-up on Thread ${claim.threadId} fired`)
      const wake: CaseWake = {
        store: input.store,
        env: input.env,
        completeReply,
        threadId: claim.threadId,
        botId: claim.botId,
        personId: claim.personId,
        wakeText: caseFollowUpWakeText({ label: claim.label, nextAction: claim.nextAction }),
      }
      const task = finishCaseWake(wake, turnId).finally(() => {
        clearChatActivityPhase(claim.threadId, claim.botId)
      })
      caseWakes.add(task)
      void task.finally(() => {
        caseWakes.delete(task)
      })
    } catch (error) {
      console.warn(`Case follow-up on Thread ${due.threadId} failed`, error)
    }
  }
}

async function finishCaseWake(input: CaseWake, turnId: string): Promise<void> {
  const bot = getBot(input.store, input.botId)
  if (!bot) {
    settleChatTurn(input.store, turnId, { outcome: 'error', errorCode: null })
    return
  }
  const viewer = viewerForPerson(input.store, input.personId)
  const role = viewer.role === 'owner' ? 'owner' : 'member'
  const member = role === 'member' ? getMember(input.store, input.personId) : undefined
  const locale = resolveHostLocale({ memberLocale: member?.locale })
  const turn = openChatTurn({
    store: input.store,
    role,
    canEditManifest: false,
    personId: input.personId,
    turnBotId: input.botId,
    wake: true,
    locale,
  })
  const history = annotateHistoryWithArtifacts(listThreadMessages(input.store, input.threadId)).map((message) => {
    if (message.role !== 'user' || !message.personId) {
      return message
    }
    const name = authorNameForPerson(input.store, message.personId) ?? 'Someone'
    return { ...message, content: `${name}: ${message.content}` }
  })
  let content: string
  let settle = settleFromReply({ via: 'error' })
  try {
    const reply = await input.completeReply({
      botName: bot.name,
      botId: bot.id,
      modelTier: bot.manifest.modelTier,
      history: applyWakePromptToHistory(history, input.wakeText),
      manifest: bot.manifest,
      skills: listBotSkills(input.store, bot.id),
      env: input.env,
      stored: getLlmGatewaySettings(input.store),
      audience: role,
      wake: true,
      locale,
      tools: turn.tools(),
      invokeTool: turn.invokeTool,
      onActivity: (phase) => {
        setChatActivityPhase(input.threadId, input.botId, phase)
      },
      onTool: (entry) => {
        recordChatTurnTool(input.threadId, input.botId, entry)
      },
      onObservability: (note) => {
        noteChatTurnObservability(input.threadId, input.botId, note)
      },
      onLlmCompletion: (usage) => {
        noteChatTurnUsage(input.threadId, input.botId, usage)
      },
    })
    content = reply.content
    settle = settleFromReply({ via: reply.via })
  } catch (error) {
    console.warn(`Case follow-up wake failed for Bot ${input.botId}`)
    content = gatewayErrorReply(role, 'transient', locale)
    settle = settleFromReply({ error })
  }
  try {
    const assistant = appendMessengerAssistantLine(input.store, {
      threadId: input.threadId,
      botId: input.botId,
      content,
      parts: turn.cards.parts(),
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
