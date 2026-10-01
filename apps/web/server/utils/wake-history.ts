/** Current-turn LLM history: wakeText replaces the stored Wake line. */
export function applyWakePromptToHistory<T extends { role: string, content: string }>(
  history: T[],
  wakeText: string,
): T[] {
  const last = history.at(-1)
  if (!last || last.role !== 'system') {
    return history
  }
  return [...history.slice(0, -1), { ...last, content: wakeText }]
}
