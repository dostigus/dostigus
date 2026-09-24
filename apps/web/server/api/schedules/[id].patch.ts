import { viewerFromUser } from '../../utils/cluster-bots'
import { scheduleSheetSave } from '../../utils/schedule-tools'

type Body = {
  cadence?: string
  timeLocal?: string
  daysOfWeek?: string[]
  wakeText?: string
  paused?: boolean
}

/** Pause, resume, or save one Schedule. Delete is a separate confirm. */
export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    return scheduleSheetSave(useStore(), id, {
      cadence: body?.cadence,
      timeLocal: body?.timeLocal,
      daysOfWeek: body?.daysOfWeek,
      wakeText: body?.wakeText,
      paused: body?.paused,
    }, viewerFromUser(session.user))
  } catch (error) {
    throwStoreError(error)
  }
})
