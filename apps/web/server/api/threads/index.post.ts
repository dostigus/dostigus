import { createMessengerThread } from '@dostigus/db'

type PostBody = {
  kind?: string
  title?: string
  personIds?: unknown
  botIds?: unknown
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const body = await readBody<PostBody>(event).catch(() => ({} as PostBody))
  try {
    const thread = createMessengerThread(useStore(), {
      kind: body?.kind ?? '',
      title: body?.title,
      actorId: session.user.id,
      personIds: stringList(body?.personIds),
      botIds: stringList(body?.botIds),
    })
    return { thread }
  } catch (error) {
    throwStoreError(error)
  }
})
