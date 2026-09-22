export default defineEventHandler(async (event) => {
  return withOwnerStore(event, (store) => ({
    members: listHouseholdMembers(store),
  }))
})
