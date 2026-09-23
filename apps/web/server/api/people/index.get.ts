import { listHouseholdPeople } from '@dostigus/db'

export default defineEventHandler(async (event) => {
  await requireHostSession(event)
  return withClusterStore((store) => ({
    people: listHouseholdPeople(store),
  }))
})
