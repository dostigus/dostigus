import type { OpenedStore } from '@dostigus/db'
import type { Message } from '@dostigus/shared'
import {
  appendMessengerAssistantLine,
  appendMessengerUserLine,
  authorNameForPerson,
  getLlmGatewaySettings,
  getMessengerThread,
  listBotSkills,
  listMessengerBots,
  listThreadMessages,
} from '@dostigus/db'
import { canEditBot, chatExpandKeywordHit, mentionedRoomBot, parseArtifactIds } from '@dostigus/shared'
import { annotateHistoryWithArtifacts, attachTurnArtifacts, attachUserArtifacts } from '../../../utils/artifacts'
import {
  clearChatActivityPhase,
  setChatActivityPhase,
} from '../../../utils/chat-activity-phase'
import { openChatTurn } from '../../../utils/chat-turn'
import { viewerFromUser } from '../../../utils/cluster-bots'
import {
  beginChatTurn,
  recordChatTurnTool,
  requestAborted,
  settleChatTurn,
  settleFromReply,
} from '../../../utils/turn-journal'

type PostBody = {
  content?: string
  artifactIds?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const role = session.user.role === 'member' ? 'member' : 'owner'
  const personId = session.user.id
  const threadId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<PostBody>(event).catch(() => ({} as PostBody))

  let activityBotId = ''
  let turnId = ''
  try {
    const store = useStore()
    const thread = getMessengerThread(store, threadId, personId)
    const artifactIds = parseArtifactIds(body?.artifactIds)
    const user = appendMessengerUserLine(store, {
      threadId,
      personId,
      content: body?.content ?? '',
      allowEmpty: artifactIds.length > 0,
    })
    if (artifactIds.length > 0) {
      user.artifacts = attachUserArtifacts(store, user.id, artifactIds, personId)
    }
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
    activityBotId = mentioned.bot.id
    turnId = beginChatTurn(store, {
      threadId,
      botId: activityBotId,
      personId,
      trigger: 'mention',
    })
    setChatActivityPhase(threadId, activityBotId, 'thinking')
    const history = annotateHistoryWithArtifacts(listThreadMessages(store, threadId)).map((message) => {
      if (message.role !== 'user' || !message.personId) {
        return message
      }
      const name = authorNameForPerson(store, message.personId) ?? 'Someone'
      return { ...message, content: `${name}: ${message.content}` }
    })
    const viewer = viewerFromUser({ id: personId, role })
    const canEditManifest = canEditBot(mentioned.bot, viewer)
    const expand = chatExpandKeywordHit(user.content)
    const turn = openChatTurn({
      store,
      role,
      canEditManifest,
      personId,
      turnBotId: mentioned.bot.id,
      expand,
    })
    const reply = await completeAssistantReply({
      botName: mentioned.bot.name,
      botId: mentioned.bot.id,
      modelTier: mentioned.bot.manifest.modelTier,
      history,
      manifest: mentioned.bot.manifest,
      skills: listBotSkills(store, mentioned.bot.id),
      stored: getLlmGatewaySettings(store),
      audience: role,
      canEditManifest,
      expand,
      tools: turn.tools(),
      invokeTool: turn.invokeTool,
      onActivity: (phase) => {
        setChatActivityPhase(threadId, mentioned.bot.id, phase)
      },
      onTool: (entry) => {
        recordChatTurnTool(threadId, mentioned.bot.id, entry)
      },
    })
    const assistant = appendMessengerAssistantLine(store, {
      threadId,
      botId: mentioned.bot.id,
      content: reply.content,
      parts: turn.cards.parts(),
    })
    if (turn.artifacts.ids.length > 0) {
      assistant.artifacts = attachTurnArtifacts(store, assistant.id, turn.artifacts.ids)
    }
    settleChatTurn(store, turnId, settleFromReply({
      via: reply.via,
      aborted: requestAborted(event),
    }))
    turnId = ''
    return { user: present(store, user), assistant: present(store, assistant), via: reply.via }
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
    if (activityBotId) {
      clearChatActivityPhase(threadId, activityBotId)
    }
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
