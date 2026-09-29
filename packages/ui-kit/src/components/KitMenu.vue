<template>
  <DropdownMenuRoot
    v-model:open="open"
    :modal="modal"
  >
    <DropdownMenuTrigger
      as-child
      :disabled="disabled"
    >
      <slot
        name="trigger"
        :open="open"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        class="kit-popover kit-menu"
        :side="side"
        :align="align"
        :side-offset="6"
        :collision-padding="8"
        loop
        @close-auto-focus="emit('closeAutoFocus', $event)"
      >
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'

withDefaults(defineProps<{
  /** Preferred edge. The menu flips when the viewport has no room. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  disabled?: boolean
  /** A modal menu takes the first outside click to close. */
  modal?: boolean
}>(), {
  side: 'bottom',
  align: 'start',
  disabled: false,
  modal: true,
})

const emit = defineEmits<{
  /** Reka returns focus to the trigger on close. Call `preventDefault()` to keep it where an item moved it. */
  closeAutoFocus: [event: Event]
}>()

const open = defineModel<boolean>('open', { default: false })
</script>

<style src="../kit.css"></style>
