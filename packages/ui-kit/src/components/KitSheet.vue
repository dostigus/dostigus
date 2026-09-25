<template>
  <SheetShell
    v-model:open="open"
    kind="sheet"
    :edge="edge"
    :title="title"
    :description="description"
    :title-align="titleAlign"
    :close="close"
    :close-label="closeLabel"
  >
    <template
      v-if="$slots.media"
      #media
    >
      <slot name="media" />
    </template>
    <slot />
  </SheetShell>
</template>

<script setup lang="ts">
import SheetShell from './SheetShell.vue'

withDefaults(defineProps<{
  title: string
  description?: string
  /** `bottom` is the default drawer. `end` is a right-edge drawer. */
  edge?: 'bottom' | 'end'
  titleAlign?: 'start' | 'center'
  close?: 'text' | 'icon'
  closeLabel?: string
}>(), {
  edge: 'bottom',
  titleAlign: 'start',
  close: 'text',
  closeLabel: 'Close',
})

const open = defineModel<boolean>('open', { required: true })
</script>
