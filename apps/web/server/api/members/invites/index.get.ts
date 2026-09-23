export default defineEventHandler(async (event) => {
  return withOwnerStore(event, (store) => ({
    invites: listHouseholdInvites(store),
  }))
})
