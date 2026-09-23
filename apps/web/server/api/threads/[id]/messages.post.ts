import type { OpenedStore } from '@dostigus/db'
import type { Message } from '@dostigus/shared'
import {
  appendMessengerAssistantLine,
  appendMessengerUserLine,
  authorNameForPerson,
  getLlmGatewaySettings,
  getMessengerThread,
  listMessengerBots,
  listThreadMessages,
} from '@dostigus/db'
import { mentionedRoomBot } from '@dostigus/shared'
import { invokeChatMcpTool } from '../../../utils/mcp-platform-tools'

type PostBody = {
  content?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const role = session.user.role === 'member' ? 'member' : 'owner'
  const personId = session.user.id
  const threadId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<PostBody>(event).catch(() => ({} as PostBody))

  try {
    const store = useStore()
    const thread = getMessengerThread(store, threadId, personId)
    const user = appendMessengerUserLine(store, {
      threadId,
      personId,
      content: body?.content ?? '',
    })
    if (thread.kind !== 'room') {
      return { user: present(store, user), assistant: null, via: null }
    }
    const bots = listMessengerBots(store, threadId, personId).map((bot) => ({
      id: bot.id,
      name: bot.name,
      bot,
    }))
    const mentioned = mentionedRoomBot(user.content, bots)
    if (!mentioned) {
      return { user: present(store, user), assistant: null, via: null }
    }
    const history = listThreadMessages(store, threadId).map((message) => {
      if (message.role !== 'user' || !message.personId) {
        return message
      }
      const name = authorNameForPerson(store, message.personId) ?? 'Someone'
      return { ...message, content: `${name}: ${message.content}` }
    })
    const reply = await completeAssistantReply({
      botName: mentioned.bot.name,
      botId: mentioned.bot.id,
      modelTier: mentioned.bot.manifest.modelTier,
      history,
      manifest: mentioned.bot.manifest,
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
    const assistant = appendMessengerAssistantLine(store, {
      threadId,
      botId: mentioned.bot.id,
      content: reply.content,
    })
    return { user: present(store, user), assistant: present(store, assistant), via: reply.via }
  } catch (error) {
    throwStoreError(error)
  }
})

function present(store: OpenedStore, message: Message) {
  return {
    ...message,
    authorName: message.role === 'user'
      ? authorNameForPerson(store, message.personId)
      : null,
  }
}
