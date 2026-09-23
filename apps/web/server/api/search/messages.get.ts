import { searchMessages } from '@dostigus/db'
import { viewerFromUser } from '../../utils/cluster-bots'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const raw = getQuery(event).q
  const query = typeof raw === 'string' ? raw : ''
  const viewer = viewerFromUser(session.user)
  return withClusterStore((store) => ({
    messages: searchMessages(store, query, undefined, viewer),
  }))
})
