import { createClusterBot, viewerFromUser } from '../../utils/cluster-bots'

type CreateBody = {
  name?: string
  modelTier?: string
  avatarShape?: string
  avatarColor?: string
  label?: string
  description?: string
  visibility?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const body = await readBody<CreateBody>(event).catch(() => ({} as CreateBody))
  const created = await withClusterStore((store) => createClusterBot(store, {
    name: body?.name,
    modelTier: body?.modelTier,
    avatarShape: body?.avatarShape,
    avatarColor: body?.avatarColor,
    label: body?.label,
    description: body?.description,
    visibility: body?.visibility,
  }, viewerFromUser(session.user)))
  setResponseStatus(event, 201)
  return created
})
