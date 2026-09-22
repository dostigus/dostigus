/**
 * Which Bot is live in this Host session. Chat publishes it; the sidebar
 * reads it so the matching row can show the same green dot.
 */
export function useHostBotActivity() {
  const liveBotId = useState<string | null>('host-bot-live', () => null)

  function setLive(botId: string, live: boolean) {
    if (!botId) {
      return
    }
    if (live) {
      liveBotId.value = botId
      return
    }
    if (liveBotId.value === botId) {
      liveBotId.value = null
    }
  }

  function isLive(botId: string): boolean {
    return liveBotId.value === botId
  }

  return { setLive, isLive }
}
