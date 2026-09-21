/** Open the Cluster Store and apply migrations when the Host starts. */
export default defineNitroPlugin((nitro) => {
  useStore()
  nitro.hooks.hook('close', () => {
    closeStore()
  })
})
