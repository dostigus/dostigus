import type { ComputedRef, Ref } from 'vue'
import { insertRoomMention, roomMentionMatches, roomMentionQuery } from '@dostigus/shared'

/**
 * `@` picker on a room composer. Lists the room's Bot participants that
 * match the text after `@`, and writes `@` plus the chosen name into the
 * draft without sending it.
 */
export function useRoomMentionPicker<T extends { id: string, name: string }>(input: {
  draft: Ref<string>
  field: Ref<HTMLTextAreaElement | null>
  bots: ComputedRef<T[]>
  enabled: ComputedRef<boolean>
}) {
  const caret = ref(0)
  const active = ref(0)
  /** The `@` the person closed or already filled; it stays closed until that `@` is gone. */
  const dismissedAt = ref<number | null>(null)

  const mention = computed(() => (
    input.enabled.value ? roomMentionQuery(input.draft.value, caret.value) : null
  ))
  const matches = computed(() => (
    mention.value ? roomMentionMatches(input.bots.value, mention.value.query) : []
  ))
  const open = computed(() => (
    mention.value != null
    && mention.value.at !== dismissedAt.value
    && matches.value.length > 0
  ))

  watch(mention, (next) => {
    if (!next) {
      dismissedAt.value = null
    }
  })
  watch(matches, () => {
    active.value = 0
  })

  function syncCaret() {
    const el = input.field.value
    caret.value = el ? el.selectionStart ?? input.draft.value.length : input.draft.value.length
  }

  function choose(bot: T) {
    const current = mention.value
    if (!current) {
      return
    }
    const next = insertRoomMention(input.draft.value, current, bot.name)
    dismissedAt.value = current.at
    input.draft.value = next.text
    caret.value = next.caret
    nextTick(() => {
      const el = input.field.value
      if (!el) {
        return
      }
      el.focus()
      el.setSelectionRange(next.caret, next.caret)
    })
  }

  /** True when the key belonged to the open picker. */
  function onKeydown(event: KeyboardEvent): boolean {
    if (!open.value || event.isComposing) {
      return false
    }
    const count = matches.value.length
    if (event.key === 'ArrowDown') {
      active.value = (active.value + 1) % count
    } else if (event.key === 'ArrowUp') {
      active.value = (active.value - 1 + count) % count
    } else if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
      const bot = matches.value[active.value]
      if (bot) {
        choose(bot)
      }
    } else if (event.key === 'Escape') {
      dismissedAt.value = mention.value?.at ?? null
    } else {
      return false
    }
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  return {
    open,
    matches,
    active,
    syncCaret,
    choose,
    onKeydown,
  }
}
