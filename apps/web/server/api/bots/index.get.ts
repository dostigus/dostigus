import { listClusterBots, viewerFromUser } from '../../utils/cluster-bots'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  return withClusterStore((store) => listClusterBots(store, viewerFromUser(session.user)))
})
