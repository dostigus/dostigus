export default defineEventHandler(async (event) => {
  return withHostStore(event, (store) => getClusterBot(store, getRouterParam(event, 'id') ?? ''))
})
