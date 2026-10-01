export default defineEventHandler(async (event) => {
  await requireOwnerOrAdminSession(event)
  try {
    return { llmGateway: publicLlmGateway() }
  } catch (error) {
    throwStoreError(error)
  }
})
