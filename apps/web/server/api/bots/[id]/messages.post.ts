import process from 'node:process'
import { getLlmGatewaySettings, listBotSkills } from '@dostigus/db'
import { canEditBot, chatExpandKeywordHit } from '@dostigus/shared'
import { previewQuietHoldMs, waitPreviewQuietHold } from '../../../../app/utils/preview-hold'
import {
  clearChatActivityPhase,
  messageThreadId,
  setChatActivityPhase,
} from '../../../utils/chat-activity-phase'
import { openChatTurn } from '../../../utils/chat-turn'
import { getClusterBot, viewerFromUser } from '../../../utils/cluster-bots'
import {
  beginChatTurn,
  recordChatTurnTool,
  requestAborted,
  settleChatTurn,
  settleFromReply,
} from '../../../utils/turn-journal'

type PostBody = {
  content?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const role = session.user.role === 'member' ? 'member' : 'owner'
  const personId = session.user.id
  const botId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<PostBody>(event).catch(() => ({} as PostBody))

  let activityThreadId = ''
  let turnId = ''
  try {
    const store = useStore()
    const viewer = viewerFromUser(session.user)
    const { bot } = getClusterBot(store, botId, viewer)
    const user = appendClusterMessage(store, {
      botId,
      role: 'user',
      content: body?.content ?? '',
      personId,
      viewer,
    })
    activityThreadId = messageThreadId(store, user.id)
    turnId = beginChatTurn(store, {
      threadId: activityThreadId,
      botId: bot.id,
      personId,
      trigger: 'user',
    })
    setChatActivityPhase(activityThreadId, bot.id, 'thinking')
    const { messages: history } = listClusterMessages(store, botId, viewer)
    const canEditManifest = canEditBot(bot, viewer)
    const expand = chatExpandKeywordHit(user.content)
    const turn = openChatTurn({
      store,
      role,
      canEditManifest,
      personId,
      turnBotId: bot.id,
      expand,
    })
    const reply = await completeAssistantReply({
      botName: bot.name,
      botId: bot.id,
      modelTier: bot.manifest.modelTier,
      history,
      manifest: bot.manifest,
      skills: listBotSkills(store, bot.id),
      stored: getLlmGatewaySettings(store),
      audience: role,
      canEditManifest,
      expand,
      tools: turn.tools(),
      invokeTool: turn.invokeTool,
      onActivity: (phase) => {
        setChatActivityPhase(activityThreadId, bot.id, phase)
      },
      onTool: (entry) => {
        recordChatTurnTool(activityThreadId, bot.id, entry)
      },
    })
    await waitPreviewQuietHold(previewQuietHoldMs({
      allowed: previewSeedAllowed({
        dev: import.meta.dev,
        flag: process.env.DOSTIGUS_PREVIEW_SEED,
      }),
      hold: getQuery(event).hold,
      via: reply.via,
    }))
    const assistant = appendClusterMessage(store, {
      botId,
      role: 'assistant',
      content: reply.content,
      parts: turn.cards.parts(),
      viewer,
    })
    settleChatTurn(store, turnId, settleFromReply({
      via: reply.via,
      aborted: requestAborted(event),
    }))
    turnId = ''
    return { user, assistant, via: reply.via }
  } catch (error) {
    if (turnId) {
      settleChatTurn(useStore(), turnId, settleFromReply({
        error,
        aborted: requestAborted(event),
      }))
      turnId = ''
    }
    throwStoreError(error)
  } finally {
    if (turnId) {
      settleChatTurn(useStore(), turnId, { outcome: 'abort' })
    }
    if (activityThreadId) {
      clearChatActivityPhase(activityThreadId, botId)
    }
  }
})
