import { viewerFromUser } from '../../utils/cluster-bots'
import { scheduleSheetDelete } from '../../utils/schedule-tools'

/** Confirmed in Sheet id `schedule`. Not a Chat Card button. */
export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const id = getRouterParam(event, 'id') ?? ''
  try {
    return scheduleSheetDelete(useStore(), id, viewerFromUser(session.user))
  } catch (error) {
    throwStoreError(error)
  }
})
