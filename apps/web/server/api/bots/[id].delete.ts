export default defineEventHandler(async (event) => {
  return await callPlatformTool('bots.delete', {
    id: getRouterParam(event, 'id') ?? '',
  })
})
