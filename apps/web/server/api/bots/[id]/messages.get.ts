export default defineEventHandler(async (event) => {
  return withHostStore(event, (store) => presentChatMessages(store, getRouterParam(event, 'id') ?? ''))
})
