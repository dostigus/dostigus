<template>
  <SheetShell
    v-model:open="open"
    kind="modal"
    :title="title"
    :description="description"
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

defineProps<{
  title: string
  description?: string
}>()

const open = defineModel<boolean>('open', { required: true })
</script>
