export default defineEventHandler(async (event) => {
  return await callPlatformTool('messages.list', {
    botId: getRouterParam(event, 'id') ?? '',
  })
})
