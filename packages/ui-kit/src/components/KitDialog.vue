<template>
  <SheetShell
    v-model:open="open"
    kind="modal"
    :title="title"
    :description="description"
    :wide="wide"
    :title-align="titleAlign"
    :close="close"
  >
    <template
      v-if="$slots.title"
      #title
    >
      <slot name="title" />
    </template>
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
  /** Wider centered Sheet for a list, such as Host search. */
  wide?: boolean
  titleAlign?: 'start' | 'center'
  close?: 'text' | 'icon'
}>(), {
  wide: false,
  titleAlign: 'start',
  close: 'text',
})

const open = defineModel<boolean>('open', { required: true })
</script>
