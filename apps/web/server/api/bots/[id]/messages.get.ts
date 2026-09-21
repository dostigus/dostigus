import { ensureGreeting, listMessages } from '@dostigus/db'

export default defineEventHandler((event) => {
  const botId = getRouterParam(event, 'id') ?? ''
  try {
    const store = useStore()
    ensureGreeting(store, botId)
    return { messages: listMessages(store, botId) }
  } catch (error) {
    throwStoreError(error)
  }
})
