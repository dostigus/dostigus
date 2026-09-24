import process from 'node:process'
import { previewChatLocation } from '../../app/utils/preview-hold'

/**
 * Local Host preview entry. GET signs in the preview Owner, ensures the
 * fixture preview Bot (`preview`), and opens that Chat. The display name
 * may change. `?tall=1` fills a tall thread once. `?parts=1` adds one
 * assistant line with a Kit button and a status once. `?kitchen=1` adds one
 * assistant line with a Kitchen button once and fills empty Kitchen tables.
 * `?hold=1` stays on the Chat URL so the next quiet reply waits for a
 * screenshot. An allowlisted `?activity=` (`thinking`, `tool`, `typing`,
 * `command`, `connect`) stays on that same Chat URL. `connect` also keeps
 * `target`. `?members=1`
 * opens Members instead of Chat. `?threads=1` seeds a preview Member,
 * that Member's Bot, a grant for the Member on Bot `preview`, and
 * separate Owner and Member bot-threads on Bot `preview`, then opens
 * the Bot list as the Owner.
 * `?threads=1&as=member` signs in that Member and opens Bot `preview`.
 * `?rooms=1` also seeds a direct message and a room with Bot `preview`.
 * The room line mentions that Bot and stores one reply, then opens the room.
 * `?rooms=1&as=member` signs in the Member on that same room.
 * `?members=1` still opens Members. HEAD ignores those queries. Not a domain Bot.
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
      {
        tall: previewTallRequested(query.tall),
        parts: previewPartsRequested(query.parts),
        kitchen: previewKitchenRequested(query.kitchen),
        threads: previewThreadsRequested(query.threads),
        rooms: previewRoomsRequested(query.rooms),
      },
    )
    const asMember = (
      previewThreadsRequested(query.threads) || previewRoomsRequested(query.rooms)
    ) && previewThreadAsMember(query.as)
    await startOwnerSession(event, asMember && seeded.member ? seeded.member : seeded.user)
    const location = previewMembersRequested(query.members)
      ? '/members'
      : previewRoomsRequested(query.rooms) && seeded.roomId
        ? `/threads/${seeded.roomId}`
        : previewThreadsRequested(query.threads)
          ? (asMember ? `/bots/${seeded.botId}` : '/')
          : previewChatLocation(seeded.botId, query.hold, query.activity, query.target)
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
