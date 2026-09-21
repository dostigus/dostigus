export default defineEventHandler(async (event) => {
  return withOwnerStore(event, (store) => getClusterBot(store, getRouterParam(event, 'id') ?? ''))
})
