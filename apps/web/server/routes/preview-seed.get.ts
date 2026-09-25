import process from 'node:process'

/**
 * Local Host preview entry. GET signs in the preview Owner, ensures the
 * fixture preview Bot (`preview`), and opens that Chat. The display name
 * may change. `?tall=1` fills a tall thread once. `?parts=1` adds one
 * assistant line with a Kit button and a status once. `?kitchen=1` adds one
 * assistant line with a Kitchen button once and fills empty Kitchen tables.
 * `?schedules=1` seeds this person's Schedules on Bot `preview`, wake Turns
 * for run history, and one Schedule Chat Card. HEAD ignores that query.
 * `?system=1` adds the three Skill / self-settings system lines once on the
 * Owner's bot-thread for Bot `preview` (Skill upsert, Skill delete, Bot
 * update). Compose with `?hold=1`, `?activity=`, and `?parts=1`.
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
 * `?members=1` still opens Members. `?settings=1` opens Settings →
 * Провайдеры. `?providers=1` also saves the fixture OpenRouter Provider
 * when the Store has none, then opens that page. `?members=1` still wins.
 * HEAD ignores those queries. Not a domain Bot.
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
        schedules: previewSchedulesRequested(query.schedules),
        system: previewSystemRequested(query.system),
        threads: previewThreadsRequested(query.threads),
        rooms: previewRoomsRequested(query.rooms),
      },
    )
    if (previewProvidersRequested(query.providers)) {
      ensurePreviewOpenRouterProvider(useStore())
    }
    const asMember = (
      previewThreadsRequested(query.threads) || previewRoomsRequested(query.rooms)
    ) && previewThreadAsMember(query.as)
    await startOwnerSession(event, asMember && seeded.member ? seeded.member : seeded.user)
    return sendRedirect(event, previewSeedRedirect({
      botId: seeded.botId,
      roomId: seeded.roomId,
      members: query.members,
      settings: query.settings,
      providers: query.providers,
      threads: query.threads,
      rooms: query.rooms,
      as: query.as,
      hold: query.hold,
      activity: query.activity,
      target: query.target,
    }), 302)
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
