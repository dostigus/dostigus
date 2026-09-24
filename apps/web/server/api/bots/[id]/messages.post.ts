import process from 'node:process'
import { getLlmGatewaySettings, listBotSkills } from '@dostigus/db'
import { canEditBot } from '@dostigus/shared'
import { previewQuietHoldMs, waitPreviewQuietHold } from '../../../../app/utils/preview-hold'
import {
  clearChatActivityPhase,
  messageThreadId,
  setChatActivityPhase,
} from '../../../utils/chat-activity-phase'
import { getClusterBot, viewerFromUser } from '../../../utils/cluster-bots'
import { invokeChatMcpTool } from '../../../utils/mcp-platform-tools'

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
    setChatActivityPhase(activityThreadId, bot.id, 'thinking')
    const { messages: history } = listClusterMessages(store, botId, viewer)
    const canEditManifest = canEditBot(bot, viewer)
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
      tools: chatMcpToolsAsOpenAi(role, { canEditManifest }),
      invokeTool: (name, args) => invokeChatMcpTool({
        name,
        args,
        store,
        role,
        personId,
        turnBotId: bot.id,
      }),
      onActivity: (phase) => {
        setChatActivityPhase(activityThreadId, bot.id, phase)
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
      viewer,
    })
    return { user, assistant, via: reply.via }
  } catch (error) {
    throwStoreError(error)
  } finally {
    if (activityThreadId) {
      clearChatActivityPhase(activityThreadId, botId)
    }
  }
})
