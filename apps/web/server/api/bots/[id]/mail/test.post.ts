import { previewBotMailBinding } from '@dostigus/db'
import { viewerFromUser } from '../../../../utils/cluster-bots'
import { mailBindingInputFromBody, requireMailBindingBot } from '../../../../utils/mail-binding'
import { testMailBinding } from '../../../../utils/mail-tools'

/** Sign in to IMAP and SMTP with the form as typed. An empty password uses the stored one. */
export default defineEventHandler(async (event) => {
  const session = await requireOwnerOrAdminSession(event)
  const botId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<unknown>(event).catch(() => ({}))
  try {
    const store = useStore()
    requireMailBindingBot(store, botId, viewerFromUser(session.user))
    const binding = previewBotMailBinding(store, botId, mailBindingInputFromBody(body))
    return await testMailBinding(store, binding)
  } catch (error) {
    throwStoreError(error)
  }
})
