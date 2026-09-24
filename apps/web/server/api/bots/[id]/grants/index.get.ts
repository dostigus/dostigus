import { listClusterBotGrants, viewerFromUser } from '../../../../utils/cluster-bots'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  return withClusterStore((store) => listClusterBotGrants(
    store,
    getRouterParam(event, 'id') ?? '',
    viewerFromUser(session.user),
  ))
})
