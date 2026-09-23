import { searchMessages } from '@dostigus/db'
import { viewerFromUser } from '../../utils/cluster-bots'

const MESSENGER_KINDS = new Set(['dm', 'group', 'room'])

export default defineEventHandler(async (event) => {
  const session = await requireHostSession(event)
  const raw = getQuery(event).q
  const query = typeof raw === 'string' ? raw : ''
  const viewer = viewerFromUser(session.user)
  return withClusterStore((store) => ({
    messages: searchMessages(store, query, undefined, viewer).map((hit) => ({
      ...hit,
      href: searchHref(hit),
    })),
  }))
})

function searchHref(hit: { botId: string | null, threadId: string | null, threadKind: string | null }): string | null {
  if (hit.threadKind && MESSENGER_KINDS.has(hit.threadKind) && hit.threadId) {
    return `/threads/${hit.threadId}`
  }
  if (hit.botId) {
    return `/bots/${hit.botId}`
  }
  return hit.threadId ? `/threads/${hit.threadId}` : null
}
