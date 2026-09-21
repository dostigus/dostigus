import { deleteBot } from '@dostigus/db'

export default defineEventHandler((event) => {
  try {
    deleteBot(useStore(), getRouterParam(event, 'id') ?? '')
    return { ok: true }
  } catch (error) {
    throwStoreError(error)
  }
})
