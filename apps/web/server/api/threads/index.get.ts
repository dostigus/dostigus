import { listInboxThreads } from '@dostigus/db'
import { viewerFromUser } from '../../utils/cluster-bots'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  return withClusterStore((store) => ({
    threads: listInboxThreads(store, viewerFromUser(session.user)),
  }))
})
