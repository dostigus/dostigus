import { revokeProjectToken } from '@dostigus/db'
import { throwOwnerAuthError } from '../../../../../utils/owner-auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const tokenId = getRouterParam(event, 'tokenId') ?? ''
  try {
    return await withOwnerStore(event, (store) => ({
      token: revokeProjectToken(store, id, tokenId),
    }))
  } catch (error) {
    throwOwnerAuthError(error)
  }
})
