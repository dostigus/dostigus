<template>
  <component
    :is="as"
    class="kit-card"
    :aria-labelledby="hasTitle ? titleId : undefined"
  >
    <header
      v-if="hasTitle || description"
      class="kit-card-head"
    >
      <component
        :is="`h${headingLevel}`"
        v-if="hasTitle"
        :id="titleId"
        class="kit-card-title"
      >
        <slot name="title">
          {{ title }}
        </slot>
      </component>
      <p
        v-if="description"
        class="kit-card-desc"
      >
        {{ description }}
      </p>
    </header>
    <div class="kit-card-body">
      <slot />
    </div>
    <footer
      v-if="$slots.actions"
      class="kit-card-actions"
    >
      <slot name="actions" />
    </footer>
  </component>
</template>

<script setup lang="ts">
import { computed, useId, useSlots } from 'vue'

const props = withDefaults(defineProps<{
  /** `form` keeps submit on the card itself. */
  as?: 'section' | 'form' | 'article' | 'div'
  title?: string
  description?: string
  headingLevel?: 2 | 3
}>(), {
  as: 'section',
  headingLevel: 2,
})

const slots = useSlots()
const titleId = useId()
const hasTitle = computed(() => Boolean(props.title || slots.title))
</script>

<style src="../kit.css"></style>
