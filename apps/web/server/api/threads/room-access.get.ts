import { listRoomBotAudience } from '@dostigus/db'
import { viewerFromUser } from '../../utils/cluster-bots'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  try {
    return {
      bots: listRoomBotAudience(useStore(), viewerFromUser(session.user)),
    }
  } catch (error) {
    throwStoreError(error)
  }
})
