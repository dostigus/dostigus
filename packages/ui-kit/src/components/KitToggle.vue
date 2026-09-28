<template>
  <div
    class="kit-toggle"
    :class="[attrs.class, { 'kit-toggle--disabled': disabled }]"
    :style="attrs.style as StyleValue"
  >
    <label
      v-if="label || $slots.default"
      class="kit-toggle-label"
      :for="id"
    >
      <slot>
        {{ label }}
      </slot>
    </label>
    <SwitchRoot
      :id="id"
      v-model="model"
      v-bind="controlAttrs"
      class="kit-switch"
      :name="name"
      :disabled="disabled"
      :aria-describedby="describedBy"
      :aria-invalid="invalid || undefined"
    >
      <SwitchThumb class="kit-switch-thumb" />
    </SwitchRoot>
  </div>
</template>

<script setup lang="ts">
import type { StyleValue } from 'vue'
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { computed, useAttrs } from 'vue'
import { useKitFieldControl } from '../field'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** Visible label beside the switch. Without it, pass `aria-label`. */
  label?: string
  name?: string
  disabled?: boolean
  /** Overrides the id from `KitField`. */
  id?: string
  invalid?: boolean
}>(), {
  disabled: false,
})

const model = defineModel<boolean>({ default: false })
const attrs = useAttrs()
const { id, describedBy, invalid } = useKitFieldControl(props)

/** `class` and `style` style the row. Everything else (e.g. `aria-label`) lands on the switch. */
const controlAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
</script>

<style src="../kit.css"></style>
