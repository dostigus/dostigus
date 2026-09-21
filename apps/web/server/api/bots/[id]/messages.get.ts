export default defineEventHandler((event) => {
  return withClusterStore((store) => listClusterMessages(store, getRouterParam(event, 'id') ?? ''))
})
