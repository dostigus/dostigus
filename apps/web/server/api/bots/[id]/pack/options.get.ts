import { viewerFromUser } from '../../../../utils/cluster-bots'
import { describeClusterPackExport } from '../../../../utils/cluster-packs'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  try {
    return withClusterStore((store) => describeClusterPackExport(
      store,
      getRouterParam(event, 'id') ?? '',
      viewerFromUser(session.user),
    ))
  } catch (error) {
    throwStoreError(error)
  }
})
