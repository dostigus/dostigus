import process from 'node:process'
import { logClusterOutboundProxies, warnIfNodeUseEnvProxy } from '../utils/outbound-fetch'
import { startScheduleTicker, stopScheduleTicker } from '../utils/schedule-ticker'

/** Open the Cluster Store and apply migrations when the Host starts. */
export default defineNitroPlugin((nitro) => {
  warnIfNodeUseEnvProxy(process.env)
  logClusterOutboundProxies(process.env)
  useStore()
  startScheduleTicker()
  nitro.hooks.hook('close', () => {
    stopScheduleTicker()
    closeStore()
  })
})
