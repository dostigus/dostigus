import { viewerFromUser } from '../../../../utils/cluster-bots'
import { skillSheetRead } from '../../../../utils/skill-sheet'

/** The creator of that Bot, or the Owner. See ADR 0030. */
export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const botId = getRouterParam(event, 'id') ?? ''
  const skillId = getRouterParam(event, 'skillId') ?? ''
  try {
    return skillSheetRead(useStore(), botId, skillId, viewerFromUser(session.user))
  } catch (error) {
    throwStoreError(error)
  }
})
