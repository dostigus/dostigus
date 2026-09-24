import { revokeClusterBotGrant, viewerFromUser } from '../../../../utils/cluster-bots'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  return withClusterStore((store) => revokeClusterBotGrant(
    store,
    getRouterParam(event, 'id') ?? '',
    getRouterParam(event, 'personId') ?? '',
    viewerFromUser(session.user),
  ))
})
