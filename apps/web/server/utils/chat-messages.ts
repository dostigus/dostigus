import type { OpenedStore } from '@dostigus/db'
import type { Message } from '@dostigus/shared'
import { authorNameForPerson } from '@dostigus/db'
import { listClusterMessages } from './cluster-bots'

export type ChatLine = Message & {
  authorName: string | null
}

export function presentChatMessages(store: OpenedStore, botId: string): { messages: ChatLine[] } {
  const listed = listClusterMessages(store, botId)
  return {
    messages: listed.messages.map((message) => ({
      ...message,
      authorName: message.role === 'user'
        ? authorNameForPerson(store, message.personId)
        : null,
    })),
  }
}
