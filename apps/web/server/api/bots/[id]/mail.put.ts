import { setBotMailBinding } from '@dostigus/db'
import { viewerFromUser } from '../../../utils/cluster-bots'
import { mailBindingInputFromBody, readMailBindingState, requireMailBindingBot } from '../../../utils/mail-binding'

export default defineEventHandler(async (event) => {
  const session = await requireOwnerOrAdminSession(event)
  const botId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<unknown>(event).catch(() => ({}))
  try {
    return withClusterStore((store) => {
      requireMailBindingBot(store, botId, viewerFromUser(session.user))
      setBotMailBinding(store, botId, mailBindingInputFromBody(body), session.user.id)
      return readMailBindingState(store, botId)
    })
  } catch (error) {
    throwStoreError(error)
  }
})
