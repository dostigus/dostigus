import { getClusterBot, viewerFromUser } from '../../utils/cluster-bots'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  return withClusterStore((store) => getClusterBot(
    store,
    getRouterParam(event, 'id') ?? '',
    viewerFromUser(session.user),
  ))
})
