import { startScheduleTicker, stopScheduleTicker } from '../utils/schedule-ticker'

/** Open the Cluster Store and apply migrations when the Host starts. */
export default defineNitroPlugin((nitro) => {
  useStore()
  startScheduleTicker()
  nitro.hooks.hook('close', () => {
    stopScheduleTicker()
    closeStore()
  })
})
