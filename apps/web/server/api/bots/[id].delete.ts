export default defineEventHandler((event) => {
  return withClusterStore((store) => deleteClusterBot(store, getRouterParam(event, 'id') ?? ''))
})
