<template>
  <ul
    :id="listId"
    ref="listEl"
    class="mention-picker"
    role="listbox"
    :aria-label="$t('chat.mention.listLabel')"
  >
    <li
      v-for="(bot, index) in bots"
      :key="bot.id"
    >
      <KitListRow
        :id="optionId(bot.id)"
        as="button"
        role="option"
        tabindex="-1"
        :title="bot.name"
        :selected="index === active"
        :aria-selected="index === active"
        @mousedown.prevent
        @mouseenter="emit('hover', index)"
        @click="emit('choose', bot)"
      >
        <template #leading>
          <HostBotAvatar
            :name="bot.name"
            :seed="bot.id"
            :shape="bot.avatarShape ?? ''"
            :avatar-color="bot.avatarColor"
            size="sm"
          />
        </template>
      </KitListRow>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { ThreadParticipantView } from '@dostigus/shared'
import { KitListRow } from '@dostigus/ui-kit'

const props = defineProps<{
  listId: string
  bots: ThreadParticipantView[]
  active: number
}>()

const emit = defineEmits<{
  choose: [bot: ThreadParticipantView]
  hover: [index: number]
}>()

const listEl = ref<HTMLElement | null>(null)

function optionId(botId: string) {
  return `${props.listId}-${botId}`
}

watch(() => props.active, async () => {
  await nextTick()
  listEl.value?.querySelector('[data-selected]')?.scrollIntoView({ block: 'nearest' })
})
</script>

<style scoped>
.mention-picker {
  list-style: none;
  margin: 0;
  padding: 0.3rem;
  width: min(20rem, 100%);
  max-height: 15rem;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--sheet);
  box-shadow: 0 0.5rem 1.4rem rgb(0 0 0 / 35%);
  pointer-events: auto;
}
</style>
