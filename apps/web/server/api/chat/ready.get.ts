export default defineEventHandler(async (event) => {
  await requireHostSession(event)
  return { configured: publicLlmGateway().configured }
})
