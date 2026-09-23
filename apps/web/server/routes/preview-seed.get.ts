import process from 'node:process'

/**
 * Local Host preview entry. GET signs in the preview Owner, ensures the
 * fixture preview Bot (`preview`), and opens that Chat. The display name
 * may change. `?tall=1` fills a tall thread once. Not a domain Bot.
 * Answers 404 unless `nuxt dev` is running with `DOSTIGUS_PREVIEW_SEED=1`.
 */
export default defineEventHandler(async (event) => {
  if (!previewSeedAllowed({
    dev: import.meta.dev,
    flag: process.env.DOSTIGUS_PREVIEW_SEED,
  })) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  try {
    const seeded = await ensurePreviewCluster(
      useStore(),
      hashPassword,
      verifyPassword,
      { tall: previewTallRequested(getQuery(event).tall) },
    )
    await startOwnerSession(event, seeded.user)
    return sendRedirect(event, `/bots/${seeded.botId}`, 302)
  } catch (error) {
    if (error instanceof OwnerAuthError && error.statusCode === 401) {
      throw createError({
        statusCode: 409,
        statusMessage: PREVIEW_SEED_OWNER_CONFLICT,
      })
    }
    throwOwnerAuthError(error)
  }
})
