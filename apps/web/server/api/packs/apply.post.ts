import { viewerFromUser } from '../../utils/cluster-bots'
import { applyClusterPack, packApplyTargetFromBody, packTreeFromBody } from '../../utils/cluster-packs'

type ApplyBody = {
  pack?: unknown
  target?: string
  botId?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const body = await readBody<ApplyBody>(event).catch(() => ({} as ApplyBody))
  return withClusterStore((store) => applyClusterPack(
    store,
    packTreeFromBody(body.pack),
    packApplyTargetFromBody(body),
    viewerFromUser(session.user),
  ))
})
