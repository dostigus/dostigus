import { updateBot } from '@dostigus/db'

type PatchBody = {
  name?: string
  modelTier?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<PatchBody>(event).catch(() => ({} as PatchBody))
  try {
    const bot = updateBot(useStore(), getRouterParam(event, 'id') ?? '', {
      name: body?.name,
      modelTier: body?.modelTier,
    })
    return { bot }
  } catch (error) {
    throwStoreError(error)
  }
})
