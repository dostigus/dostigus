import { setClusterBotVisibility, viewerFromUser } from '../../../utils/cluster-bots'

type VisibilityBody = {
  visibility?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireOwnerSession(event)
  const body = await readBody<VisibilityBody>(event).catch(() => ({} as VisibilityBody))
  return withClusterStore((store) => setClusterBotVisibility(
    store,
    getRouterParam(event, 'id') ?? '',
    body?.visibility,
    viewerFromUser(session.user),
  ))
})
