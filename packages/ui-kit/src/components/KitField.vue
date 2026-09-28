<template>
  <div
    class="kit-field"
    :class="{ 'kit-field--invalid': invalid }"
  >
    <label
      class="kit-field-label"
      :for="controlId"
    >
      <slot name="label">
        {{ label }}
      </slot>
    </label>
    <slot />
    <p
      v-if="hasHint"
      :id="hintId"
      class="kit-field-hint"
    >
      <slot name="hint">
        {{ hint }}
      </slot>
    </p>
    <p
      v-if="error"
      :id="errorId"
      class="kit-field-error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, useId, useSlots } from 'vue'
import { kitFieldKey } from '../field'

const props = defineProps<{
  label: string
  /** Helper copy under the control. */
  hint?: string
  /** Inline error under the control. A non-empty string marks the control invalid. */
  error?: string
  /** Control id. Defaults to a generated id. */
  id?: string
  required?: boolean
}>()

const slots = useSlots()
const baseId = useId()
const controlId = computed(() => props.id ?? `${baseId}-control`)
const hintId = computed(() => `${controlId.value}-hint`)
const errorId = computed(() => `${controlId.value}-error`)
const hasHint = computed(() => Boolean(props.hint || slots.hint))
const invalid = computed(() => Boolean(props.error))

provide(kitFieldKey, {
  controlId,
  describedBy: computed(() => {
    const ids = [
      hasHint.value ? hintId.value : undefined,
      invalid.value ? errorId.value : undefined,
    ].filter(Boolean)
    return ids.length ? ids.join(' ') : undefined
  }),
  invalid,
  required: computed(() => props.required),
})
</script>

<style src="../kit.css"></style>
