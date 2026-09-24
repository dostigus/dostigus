import { viewerFromUser } from '../../../../utils/cluster-bots'
import { skillSheetDelete } from '../../../../utils/skill-sheet'

/** Confirmed in Sheet id `skill`. Not a Chat Card button. */
export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const botId = getRouterParam(event, 'id') ?? ''
  const skillId = getRouterParam(event, 'skillId') ?? ''
  try {
    return skillSheetDelete(useStore(), botId, skillId, viewerFromUser(session.user))
  } catch (error) {
    throwStoreError(error)
  }
})
