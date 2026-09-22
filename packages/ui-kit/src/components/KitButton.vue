<template>
  <button
    :type="type"
    class="kit-button"
    :class="variant === 'solid' ? undefined : `kit-button--${variant}`"
    :disabled="disabled || undefined"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'button' | 'submit' | 'reset'
  variant?: 'solid' | 'ghost' | 'icon'
  disabled?: boolean
}>(), {
  type: 'button',
  variant: 'solid',
  disabled: false,
})
</script>

<style src="../kit.css"></style>
