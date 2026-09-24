import { viewerFromUser } from '../../../../utils/cluster-bots'
import { skillSheetSave } from '../../../../utils/skill-sheet'

type Body = {
  id?: string
  instructions?: string
}

/** Save one Skill through the same upsert Chat uses. */
export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const botId = getRouterParam(event, 'id') ?? ''
  const skillId = getRouterParam(event, 'skillId') ?? ''
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  try {
    return skillSheetSave(useStore(), botId, skillId, {
      id: body?.id,
      instructions: body?.instructions,
    }, viewerFromUser(session.user))
  } catch (error) {
    throwStoreError(error)
  }
})
