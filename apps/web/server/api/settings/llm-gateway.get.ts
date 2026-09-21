export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  try {
    return { llmGateway: publicLlmGateway() }
  } catch (error) {
    throwStoreError(error)
  }
})
