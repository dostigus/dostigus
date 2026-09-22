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
