import { updateThreadCase } from '@dostigus/db'

type PatchBody = {
  status?: unknown
  label?: unknown
  nextAction?: unknown
  followUpAt?: unknown
  followUpBotId?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const threadId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<PatchBody>(event).catch(() => ({} as PatchBody))
  try {
    const thread = updateThreadCase(useStore(), {
      threadId,
      actorId: session.user.id,
      status: body?.status,
      label: body?.label,
      nextAction: body?.nextAction,
      followUpAt: body?.followUpAt,
      followUpBotId: body?.followUpBotId,
    })
    return { thread }
  } catch (error) {
    throwStoreError(error)
  }
})
