<template>
  <SheetShell
    v-model:open="open"
    kind="sheet"
    :edge="edge"
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

withDefaults(defineProps<{
  title: string
  description?: string
  /** `bottom` is the default drawer. `end` is a right-edge drawer. */
  edge?: 'bottom' | 'end'
}>(), {
  edge: 'bottom',
})

const open = defineModel<boolean>('open', { required: true })
</script>
