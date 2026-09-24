import { viewerFromUser } from '../../../utils/cluster-bots'
import { scheduleClosetCreate } from '../../../utils/schedule-tools'

type Body = {
  name?: string
  cadence?: string
  timeLocal?: string
  daysOfWeek?: string[]
  wakeText?: string
}

/** Create this person's Schedule on this Bot. Same Store create as MCP. */
export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const botId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    return scheduleClosetCreate(useStore(), botId, {
      name: body?.name,
      cadence: body?.cadence,
      timeLocal: body?.timeLocal,
      daysOfWeek: body?.daysOfWeek,
      wakeText: body?.wakeText,
    }, viewerFromUser(session.user))
  } catch (error) {
    throwStoreError(error)
  }
})
