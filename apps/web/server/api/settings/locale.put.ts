type PutBody = {
  locale?: unknown
}

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  if (isPreviewLocaleForced()) {
    writeLocaleCookie(event, 'en')
    return { locale: 'en' as const }
  }
  const body = await readBody<PutBody>(event).catch(() => ({} as PutBody))
  const locale = parseLocaleBody(body.locale)
  writeLocaleCookie(event, locale)
  return { locale }
})
