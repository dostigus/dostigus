import process from 'node:process'
import { previewChatLocation } from '../../app/utils/preview-hold'

/**
 * Local Host preview entry. GET signs in the preview Owner, ensures the
 * fixture preview Bot (`preview`), and opens that Chat. The display name
 * may change. `?tall=1` fills a tall thread once. `?hold=1` stays on the
 * Chat URL so the next quiet reply waits for a screenshot. `?members=1`
 * opens Members instead of Chat. HEAD ignores that query. Not a domain Bot.
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
    const query = getQuery(event)
    const seeded = await ensurePreviewCluster(
      useStore(),
      hashPassword,
      verifyPassword,
      { tall: previewTallRequested(query.tall) },
    )
    await startOwnerSession(event, seeded.user)
    const location = previewMembersRequested(query.members)
      ? '/members'
      : previewChatLocation(seeded.botId, query.hold)
    return sendRedirect(event, location, 302)
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
