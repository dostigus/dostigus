import { grantClusterBot, viewerFromUser } from '../../../../utils/cluster-bots'

type GrantBody = {
  personId?: string
  personIds?: string[]
  allCurrentMembers?: boolean
}

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const body = await readBody<GrantBody>(event).catch(() => ({} as GrantBody))
  return withClusterStore((store) => grantClusterBot(
    store,
    getRouterParam(event, 'id') ?? '',
    {
      personId: body?.personId,
      personIds: Array.isArray(body?.personIds) ? body.personIds : undefined,
      allCurrentMembers: body?.allCurrentMembers === true,
    },
    viewerFromUser(session.user),
  ))
})
