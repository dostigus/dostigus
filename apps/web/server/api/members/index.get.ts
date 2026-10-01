export default defineEventHandler(async (event) => {
  return withOwnerOrAdminStore(event, (store) => ({
    members: listHouseholdMembers(store),
  }))
})
