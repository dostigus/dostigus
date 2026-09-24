import { viewerFromUser } from '../../../utils/cluster-bots'
import { scheduleClosetList } from '../../../utils/schedule-tools'

/** This person's Schedules on this Bot. Same Store list as MCP. See ADR 0027. */
export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const botId = getRouterParam(event, 'id') ?? ''
  try {
    return scheduleClosetList(useStore(), botId, viewerFromUser(session.user))
  } catch (error) {
    throwStoreError(error)
  }
})
