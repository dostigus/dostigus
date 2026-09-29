<template>
  <button
    :type="type"
    class="kit-button"
    :class="[
      variant === 'solid' ? undefined : `kit-button--${variant}`,
      size === 'sm' ? 'kit-button--sm' : undefined,
    ]"
    :disabled="disabled || undefined"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'button' | 'submit' | 'reset'
  /** `close` is the quiet × that dismisses a pane, same look as the Sheet close. */
  variant?: 'solid' | 'ghost' | 'icon' | 'close'
  /** `sm` fits a Chat bubble. `md` is the page control. */
  size?: 'md' | 'sm'
  disabled?: boolean
}>(), {
  type: 'button',
  variant: 'solid',
  size: 'md',
  disabled: false,
})
</script>

<style src="../kit.css"></style>
