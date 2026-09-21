import { getLlmGatewaySettings, insertMessage, listMessages, requireBot } from '@dostigus/db'

type PostBody = {
  content?: string
}

export default defineEventHandler(async (event) => {
  const botId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<PostBody>(event).catch(() => ({} as PostBody))

  try {
    const store = useStore()
    const bot = requireBot(store, botId)
    const user = insertMessage(store, {
      botId,
      role: 'user',
      content: body?.content ?? '',
    })
    const history = listMessages(store, botId)
    const reply = await completeAssistantReply({
      botName: bot.name,
      modelTier: bot.manifest.modelTier,
      history,
      manifest: bot.manifest,
      stored: getLlmGatewaySettings(store),
    })
    const assistant = insertMessage(store, {
      botId,
      role: 'assistant',
      content: reply.content,
    })
    return { user, assistant, via: reply.via }
  } catch (error) {
    throwStoreError(error)
  }
})
