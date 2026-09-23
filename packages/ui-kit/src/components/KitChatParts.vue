<template>
  <div
    v-if="parts.length"
    class="kit-chat-parts"
  >
    <template
      v-for="(part, index) in parts"
      :key="`${part.kind}-${index}`"
    >
      <span
        v-if="part.kind === 'status'"
        class="kit-status"
        :class="`kit-status--${part.tone}`"
      >
        {{ part.label }}
      </span>
      <KitButton
        v-else-if="part.kind === 'button'"
        type="button"
        size="sm"
        @click="emit('openSheet', part.action.sheetId)"
      >
        {{ part.label }}
      </KitButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ChatPart } from '@dostigus/shared'
import KitButton from './KitButton.vue'

defineProps<{
  parts: ChatPart[]
}>()

const emit = defineEmits<{
  openSheet: [sheetId: string]
}>()
</script>

<style src="../kit.css"></style>
