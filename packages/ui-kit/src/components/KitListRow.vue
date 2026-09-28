<template>
  <component
    :is="as"
    class="kit-row"
    :class="{ 'kit-row--interactive': interactive }"
    :type="as === 'button' ? 'button' : undefined"
    :data-selected="selected ? '' : undefined"
  >
    <span
      v-if="$slots.leading"
      class="kit-row-leading"
    >
      <slot name="leading" />
    </span>
    <span class="kit-row-copy">
      <span class="kit-row-title">
        <slot name="title">
          {{ title }}
        </slot>
      </span>
      <span
        v-if="subtitle || $slots.subtitle"
        class="kit-row-subtitle"
      >
        <slot name="subtitle">
          {{ subtitle }}
        </slot>
      </span>
    </span>
    <span
      v-if="$slots.trailing"
      class="kit-row-trailing"
    >
      <slot name="trailing" />
    </span>
  </component>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** `div` / `li` are static rows. `button`, `a`, or a link component are pressable. */
  as?: 'div' | 'li' | 'button' | 'a' | Component
  title?: string
  /** One muted line under the title. */
  subtitle?: string
  selected?: boolean
}>(), {
  as: 'div',
  selected: false,
})

const interactive = computed(() => props.as !== 'div' && props.as !== 'li')
</script>

<style src="../kit.css"></style>
