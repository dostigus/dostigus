/** Purpose Card stays up until the first user line, including an optimistic one. */
export function showsBotPurposeCard(messages: readonly { role: string }[]): boolean {
  if (messages.length === 0) {
    return false
  }
  return messages.every((message) => message.role !== 'user')
}

export function withOptimisticUser<T extends { id: string }>(
  messages: readonly T[],
  optimistic: T | null,
): T[] {
  if (!optimistic) {
    return [...messages]
  }
  if (messages.some((message) => message.id === optimistic.id)) {
    return [...messages]
  }
  return [...messages, optimistic]
}
