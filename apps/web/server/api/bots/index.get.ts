export default defineEventHandler(() => {
  return withClusterStore(listClusterBots)
})
