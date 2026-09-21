export default defineEventHandler(async () => {
  return await callPlatformTool('bots.list', {})
})
