import type { ChatActivityPhase } from '../utils/chat-activity'
import {
  CHAT_ACTIVITY_POLL_MS,
  noteChatActivityPhase,
} from '../utils/chat-activity'

/**
 * Poll the open Thread while the viewer's own reply is in flight.
 * Stops when `active` drops (land, error, or leaving Chat).
 */
export function useChatActivityPhase(options: {
  active: { readonly value: boolean }
  threadId: { readonly value: string | null }
  botId: { readonly value: string | null }
}) {
  const phase = ref<ChatActivityPhase | null>(null)
  let clock = { shown: null as ChatActivityPhase | null, shownAt: 0, queued: null as ChatActivityPhase | null }
  let timer: ReturnType<typeof setInterval> | null = null
  let hold: ReturnType<typeof setTimeout> | null = null

  function clearHold() {
    if (hold) {
      clearTimeout(hold)
      hold = null
    }
  }

  function apply(next: ChatActivityPhase | null) {
    const noted = noteChatActivityPhase(clock, next, Date.now())
    clock = noted.clock
    phase.value = clock.shown
    clearHold()
    if (noted.waitMs != null) {
      hold = setTimeout(() => {
        apply(clock.queued)
      }, noted.waitMs)
    }
  }

  async function tick() {
    const threadId = options.threadId.value
    const botId = options.botId.value
    if (!options.active.value || !threadId || !botId) {
      return
    }
    try {
      const data = await $fetch<{ phase: ChatActivityPhase | null }>('/api/chat/activity', {
        query: { threadId, botId },
      })
      if (!options.active.value) {
        return
      }
      apply(data.phase)
    } catch {
      // A missed poll keeps the phase already on screen.
    }
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    clearHold()
    phase.value = null
    clock = { shown: null, shownAt: 0, queued: null }
  }

  function start() {
    stop()
    const now = Date.now()
    clock = { shown: 'thinking', shownAt: now, queued: null }
    phase.value = 'thinking'
    void tick()
    timer = setInterval(() => {
      void tick()
    }, CHAT_ACTIVITY_POLL_MS)
  }

  watch(options.active, (on) => {
    if (on) {
      start()
    } else {
      stop()
    }
  }, { immediate: true })

  onScopeDispose(stop)

  return { phase }
}
