import { addMessengerParticipant } from '@dostigus/db'

type PostBody = {
  kind?: unknown
  id?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const threadId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<PostBody>(event).catch(() => ({} as PostBody))
  try {
    const thread = addMessengerParticipant(useStore(), {
      threadId,
      actorId: session.user.id,
      kind: typeof body?.kind === 'string' ? body.kind : '',
      id: typeof body?.id === 'string' ? body.id : '',
    })
    return { thread }
  } catch (error) {
    throwStoreError(error)
  }
})
