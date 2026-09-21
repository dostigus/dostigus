import { getLlmGatewaySettings } from '@dostigus/db'

type PostBody = {
  content?: string
}

export default defineEventHandler(async (event) => {
  const botId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<PostBody>(event).catch(() => ({} as PostBody))

  const { message: user } = await callPlatformTool('messages.create', {
    botId,
    role: 'user',
    content: body?.content ?? '',
  })
  const { bot } = await callPlatformTool('bots.get', { id: botId })
  const { messages: history } = await callPlatformTool('messages.list', { botId })
  const reply = await completeAssistantReply({
    botName: bot.name,
    modelTier: bot.manifest.modelTier,
    history,
    manifest: bot.manifest,
    stored: getLlmGatewaySettings(useStore()),
  })
  const { message: assistant } = await callPlatformTool('messages.create', {
    botId,
    role: 'assistant',
    content: reply.content,
  })
  return { user, assistant, via: reply.via }
})
