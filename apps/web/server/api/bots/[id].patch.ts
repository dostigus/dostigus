type PatchBody = {
  name?: string
  modelTier?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<PatchBody>(event).catch(() => ({} as PatchBody))
  return await callPlatformTool('bots.update', {
    id: getRouterParam(event, 'id') ?? '',
    name: body?.name,
    modelTier: body?.modelTier,
  })
})
