export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  const locale = await resolveEventLocale(event)
  return { locale }
})
