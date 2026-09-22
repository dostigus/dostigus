import process from 'node:process'

/**
 * Local Host preview entry. Signs in the preview Owner, ensures one Bot,
 * and opens that Chat. Not a domain Bot. Answers 404 unless `nuxt dev`
 * is running with `DOSTIGUS_PREVIEW_SEED=1`.
 */
export default defineEventHandler(async (event) => {
  if (!previewSeedAllowed({
    dev: import.meta.dev,
    flag: process.env.DOSTIGUS_PREVIEW_SEED,
  })) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  try {
    const seeded = await ensurePreviewCluster(useStore(), hashPassword, verifyPassword)
    await startOwnerSession(event, seeded.user)
    return sendRedirect(event, `/bots/${seeded.botId}`, 302)
  } catch (error) {
    if (error instanceof OwnerAuthError && error.statusCode === 401) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This Store already has an Owner. Preview seed signs in only as username preview. Use a fresh DATABASE_URL or sign in at /login.',
      })
    }
    throwOwnerAuthError(error)
  }
})
