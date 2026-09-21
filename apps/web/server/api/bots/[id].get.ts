import { requireBot } from '@dostigus/db'

export default defineEventHandler((event) => {
  try {
    return { bot: requireBot(useStore(), getRouterParam(event, 'id') ?? '') }
  } catch (error) {
    throwStoreError(error)
  }
})
