import { deleteBotMailBinding } from '@dostigus/db'
import { viewerFromUser } from '../../../utils/cluster-bots'
import { requireMailBindingBot } from '../../../utils/mail-binding'

export default defineEventHandler(async (event) => {
  const session = await requireOwnerOrAdminSession(event)
  const botId = getRouterParam(event, 'id') ?? ''
  try {
    return withClusterStore((store) => {
      requireMailBindingBot(store, botId, viewerFromUser(session.user))
      return { removed: deleteBotMailBinding(store, botId) }
    })
  } catch (error) {
    throwStoreError(error)
  }
})
