export default defineEventHandler(async (event) => {
  return withOwnerStore(event, (store) => listClusterMessages(store, getRouterParam(event, 'id') ?? ''))
})
