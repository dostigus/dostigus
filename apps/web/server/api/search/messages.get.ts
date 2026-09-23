import { searchMessages } from '@dostigus/db'

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).q
  const query = typeof raw === 'string' ? raw : ''
  return withHostStore(event, (store) => ({
    messages: searchMessages(store, query),
  }))
})
