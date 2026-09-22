import { getLlmGatewaySettings } from '@dostigus/db'
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
    const { bot } = getClusterBot(store, botId)
    const user = appendClusterMessage(store, {
      botId,
      role: 'user',
      content: body?.content ?? '',
      personId,
    })
    const { messages: history } = listClusterMessages(store, botId)
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
