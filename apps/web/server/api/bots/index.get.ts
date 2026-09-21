import { listBots } from '@dostigus/db'

export default defineEventHandler(() => {
  try {
    return { bots: listBots(useStore()) }
  } catch (error) {
    throwStoreError(error)
  }
})
