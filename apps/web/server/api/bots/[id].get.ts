export default defineEventHandler((event) => {
  return withClusterStore((store) => getClusterBot(store, getRouterParam(event, 'id') ?? ''))
})
