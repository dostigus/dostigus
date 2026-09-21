import { createBot } from '@dostigus/db'

type CreateBody = {
  name?: string
  modelTier?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateBody>(event).catch(() => ({} as CreateBody))
  try {
    const { bot, greeting } = createBot(useStore(), {
      name: body?.name,
      modelTier: body?.modelTier,
    })
    setResponseStatus(event, 201)
    return { bot, greeting }
  } catch (error) {
    throwStoreError(error)
  }
})
