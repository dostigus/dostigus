import { viewerFromUser } from '../../utils/cluster-bots'
import { scheduleSheetRead } from '../../utils/schedule-tools'

/** The person on the Schedule, or the Owner. See ADR 0030. */
export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const id = getRouterParam(event, 'id') ?? ''
  try {
    return scheduleSheetRead(useStore(), id, viewerFromUser(session.user))
  } catch (error) {
    throwStoreError(error)
  }
})
