<template>
  <SelectRoot
    v-model="model"
    :name="name"
    :required="required || undefined"
    :disabled="disabled"
  >
    <SelectTrigger
      :id="id"
      class="kit-input kit-select"
      :aria-describedby="describedBy"
      :aria-invalid="invalid || undefined"
    >
      <SelectValue
        class="kit-select-value"
        :class="{ 'kit-select-value--empty': !selected }"
        :placeholder="placeholder"
      >
        {{ selected ? selected.label : placeholder }}
      </SelectValue>
      <span
        class="kit-select-chevron"
        aria-hidden="true"
      />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        class="kit-popover kit-select-content"
        position="popper"
        align="start"
        :side-offset="6"
      >
        <SelectViewport class="kit-select-viewport">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            class="kit-option"
            :value="option.value"
            :disabled="option.disabled"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
            <SelectItemIndicator class="kit-option-check" />
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts">
import type { KitSelectOption } from '../field'
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'
import { computed } from 'vue'
import { useKitFieldControl } from '../field'

const props = withDefaults(defineProps<{
  options: KitSelectOption[]
  placeholder?: string
  /** Form name for the hidden native select. */
  name?: string
  disabled?: boolean
  /** Overrides the id from `KitField`. */
  id?: string
  invalid?: boolean
}>(), {
  placeholder: '',
  disabled: false,
})

const model = defineModel<string>()
const { id, describedBy, invalid, required } = useKitFieldControl(props)
const selected = computed(() => props.options.find((option) => option.value === model.value))
</script>

<style src="../kit.css"></style>
