import process from 'node:process'
import { getLlmGatewaySettings } from '@dostigus/db'
import { previewQuietHoldMs, waitPreviewQuietHold } from '../../../../app/utils/preview-hold'
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
    const { messages: history } = listClusterMessages(store, botId, viewer)
    const reply = await completeAssistantReply({
      botName: bot.name,
      botId: bot.id,
      modelTier: bot.manifest.modelTier,
      history,
      manifest: bot.manifest,
      stored: getLlmGatewaySettings(store),
      audience: role,
      tools: chatMcpToolsAsOpenAi(role),
      invokeTool: (name, args) => invokeChatMcpTool({
        name,
        args,
        store,
        role,
        personId,
      }),
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
  }
})
