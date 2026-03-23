export default defineEventHandler(async (event) => {
  const { user } = useRepository()

  const seedUser = await user.findByEmail('goose@dostigus.ru')
  if (!seedUser) {
    throw createError({ statusCode: 500, message: 'Seed user not found' })
  }

  await setUserSession(event, {
    user: {
      id: seedUser.id,
      email: seedUser.email,
      name: seedUser.name,
      avatarUrl: seedUser.avatarUrl,
    },
  })

  return { ok: true }
})
