export default defineEventHandler(async (event) => {
  return withOwnerOrAdminStore(event, (store) => ({
    invites: listHouseholdInvites(store),
  }))
})
