export default defineEventHandler(async (event) => {
  return await callPlatformTool('bots.get', {
    id: getRouterParam(event, 'id') ?? '',
  })
})
