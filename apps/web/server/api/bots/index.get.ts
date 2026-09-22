export default defineEventHandler(async (event) => {
  return withHostStore(event, listClusterBots)
})
