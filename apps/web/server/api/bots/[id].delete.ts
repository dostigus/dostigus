export default defineEventHandler(async (event) => {
  return withOwnerStore(event, (store) => deleteClusterBot(store, getRouterParam(event, 'id') ?? ''))
})
