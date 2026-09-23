import { authorNameForPerson, getMessengerThread, listThreadMessages } from '@dostigus/db'

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const threadId = getRouterParam(event, 'id') ?? ''
  try {
    const store = useStore()
    const thread = getMessengerThread(store, threadId, session.user.id)
    const messages = listThreadMessages(store, threadId).map((message) => ({
      ...message,
      authorName: message.role === 'user'
        ? authorNameForPerson(store, message.personId)
        : null,
    }))
    return { thread, messages }
  } catch (error) {
    throwStoreError(error)
  }
})
