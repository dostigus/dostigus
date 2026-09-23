type CookedBody = {
  label?: string
}

/**
 * Owner or Member. The cooked row stores the signed-in person.
 * A body person id is ignored.
 */
export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const body = await readBody<CookedBody>(event).catch(() => ({} as CookedBody))
  try {
    const saved = markClusterCooked(useStore(), {
      label: body?.label,
      personId: session.user.id,
    })
    setResponseStatus(event, 201)
    return saved
  } catch (error) {
    throwStoreError(error)
  }
})
