/** Ask the open Chat to show the Bot settings Sheet. */
export function useHostBotSheet() {
  const pendingId = useState<string | null>('host-bot-sheet', () => null)

  function requestOpen(botId: string) {
    if (!botId) {
      return
    }
    pendingId.value = botId
  }

  return { pendingId, requestOpen }
}
