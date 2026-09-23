import { presentChatMessages } from '../../../utils/chat-messages'
import { viewerFromUser } from '../../../utils/cluster-bots'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  return withClusterStore((store) => presentChatMessages(
    store,
    getRouterParam(event, 'id') ?? '',
    viewerFromUser(session.user),
  ))
})
