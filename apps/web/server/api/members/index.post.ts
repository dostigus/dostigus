/**
 * Owner-only JSON write. Copy this file for the next Members route.
 * Gate: `requireOwnerSession` (401 signed out, 403 Member). A read uses
 * `withOwnerStore` in `index.get.ts`. Map `OwnerAuthError` and `StoreError`
 * with `throwOwnerAuthError`. Vitest memory Store: `household.test.ts`.
 * Full notes: AGENTS.md "Host API patterns".
 */
type CreateBody = MemberCreateBody

export default defineEventHandler(async (event) => {
  await requireOwnerSession(event)
  const body = await readBody<CreateBody>(event).catch(() => ({} as CreateBody))
  try {
    const member = await addHouseholdMember(useStore(), body, hashPassword)
    setResponseStatus(event, 201)
    return { member }
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
