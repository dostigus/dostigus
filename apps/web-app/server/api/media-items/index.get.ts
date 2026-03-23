export default defineEventHandler(async () => {
  const { mediaItem } = useRepository()

  return mediaItem.findAll({ limit: 20 })
})
