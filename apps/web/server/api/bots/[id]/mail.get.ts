import { viewerFromUser } from '../../../utils/cluster-bots'
import { readMailBindingState, requireMailBindingBot } from '../../../utils/mail-binding'

export default defineEventHandler(async (event) => {
  const session = await requireOwnerOrAdminSession(event)
  const botId = getRouterParam(event, 'id') ?? ''
  try {
    return withClusterStore((store) => {
      requireMailBindingBot(store, botId, viewerFromUser(session.user))
      return readMailBindingState(store, botId)
    })
  } catch (error) {
    throwStoreError(error)
  }
})
