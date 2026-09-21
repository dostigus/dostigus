import { getLlmGatewaySettings } from '@dostigus/db'
import { invokeChatMcpTool } from '../../../utils/mcp-platform-tools'

type PostBody = {
  content?: string
}

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  const botId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<PostBody>(event).catch(() => ({} as PostBody))

  try {
    const store = useStore()
    const { bot } = getClusterBot(store, botId)
    const user = appendClusterMessage(store, {
      botId,
      role: 'user',
      content: body?.content ?? '',
    })
    const { messages: history } = listClusterMessages(store, botId)
    const reply = await completeAssistantReply({
      botName: bot.name,
      botId: bot.id,
      modelTier: bot.manifest.modelTier,
      history,
      manifest: bot.manifest,
      stored: getLlmGatewaySettings(store),
      invokeTool: (name, args) => invokeChatMcpTool({ name, args, store }),
    })
    const assistant = appendClusterMessage(store, {
      botId,
      role: 'assistant',
      content: reply.content,
    })
    return { user, assistant, via: reply.via }
  } catch (error) {
    throwStoreError(error)
  }
})
