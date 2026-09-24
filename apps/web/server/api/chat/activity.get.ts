import { readThreadChatActivity } from '../../utils/chat-activity-phase'
import { viewerFromUser } from '../../utils/cluster-bots'

function queryString(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : ''
}

/** Cheap poll for the open Thread. Same session gate as Chat. */
export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const query = getQuery(event)
  try {
    return readThreadChatActivity(useStore(), {
      viewer: viewerFromUser(session.user),
      threadId: queryString(query.threadId),
      botId: queryString(query.botId),
    })
  } catch (error) {
    throwStoreError(error)
  }
})
