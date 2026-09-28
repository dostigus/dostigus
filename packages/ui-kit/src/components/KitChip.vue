<template>
  <component
    :is="as"
    class="kit-chip"
    :class="tone === 'neutral' ? undefined : `kit-chip--${tone}`"
    :type="as === 'button' ? 'button' : undefined"
    :disabled="as === 'button' && disabled ? true : undefined"
    :data-selected="selected ? '' : undefined"
    :aria-pressed="pressed"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'

const props = withDefaults(defineProps<{
  /** `span` is a status label. `button` is a choice the user can press. */
  as?: 'span' | 'button'
  tone?: 'neutral' | 'ok' | 'warn'
  /** Choice chips only. */
  selected?: boolean
  disabled?: boolean
}>(), {
  as: 'span',
  tone: 'neutral',
  selected: undefined,
  disabled: false,
})

const attrs = useAttrs()

/** A chip in a `role="radio"` group reports `aria-checked` itself, not `aria-pressed`. */
const pressed = computed(() => {
  if (props.as !== 'button' || props.selected === undefined || attrs.role) {
    return undefined
  }
  return props.selected
})
</script>

<style src="../kit.css"></style>
