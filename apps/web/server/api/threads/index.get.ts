import { listInboxThreads } from '@dostigus/db'
import { viewerFromUser } from '../../utils/cluster-bots'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const caseStatus = getQuery(event).caseStatus
  if (caseStatus !== undefined && caseStatus !== 'open') {
    throw createError({ statusCode: 400, statusMessage: 'caseStatus must be open' })
  }
  return withClusterStore((store) => ({
    threads: listInboxThreads(store, viewerFromUser(session.user), { caseStatus }),
  }))
})
