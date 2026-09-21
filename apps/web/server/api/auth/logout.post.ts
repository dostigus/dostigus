export default defineEventHandler(async (event) => {
  await endOwnerSession(event)
  return { ok: true }
})
