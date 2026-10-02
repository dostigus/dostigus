/** Open the Catalog Store (not the Cluster Store) when the Host starts. */
export default defineNitroPlugin((nitro) => {
  useCatalogStore()
  nitro.hooks.hook('close', () => {
    closeCatalogStore()
  })
})
