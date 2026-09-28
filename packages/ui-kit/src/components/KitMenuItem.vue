<template>
  <DropdownMenuItem
    :as="as"
    class="kit-menu-item"
    :class="{
      'kit-menu-item--danger': danger,
      'kit-menu-item--hint': hint || $slots.hint,
    }"
    :disabled="disabled"
    @select="emit('select', $event)"
  >
    <span class="kit-menu-item-label">
      <slot>{{ label }}</slot>
    </span>
    <span
      v-if="hint || $slots.hint"
      class="kit-menu-item-hint"
    >
      <slot name="hint">{{ hint }}</slot>
    </span>
  </DropdownMenuItem>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { DropdownMenuItem } from 'reka-ui'

withDefaults(defineProps<{
  label?: string
  /** One muted line under the label. */
  hint?: string
  /** Destructive action: `--accent` label. */
  danger?: boolean
  disabled?: boolean
  /** `div` runs `select`. `a` or a link component navigates. */
  as?: 'div' | 'a' | Component
}>(), {
  danger: false,
  disabled: false,
  as: 'div',
})

/** Call `preventDefault()` on the event to keep the menu open. */
const emit = defineEmits<{
  select: [event: Event]
}>()
</script>

<style src="../kit.css"></style>
