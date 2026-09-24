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
      <article
        v-else-if="part.kind === 'card'"
        class="kit-card"
        :class="`kit-card--${part.tone}`"
      >
        <p class="kit-card-title">
          {{ part.title }}
        </p>
        <p class="kit-card-body">
          {{ part.body }}
        </p>
        <div
          v-if="part.actions.length"
          class="kit-card-actions"
        >
          <KitButton
            v-for="(action, actionIndex) in part.actions"
            :key="`${action.label}-${actionIndex}`"
            type="button"
            size="sm"
            @click="emit('openSheet', action.action.sheetId, part.targetId)"
          >
            {{ action.label }}
          </KitButton>
        </div>
      </article>
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
  openSheet: [sheetId: string, targetId?: string]
}>()
</script>

<style src="../kit.css"></style>
