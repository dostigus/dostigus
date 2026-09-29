<template>
  <input
    :id="id"
    ref="el"
    v-model="model"
    class="kit-input"
    :type="type"
    :aria-describedby="describedBy"
    :aria-invalid="invalid || undefined"
    :required="required || undefined"
  >
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useKitFieldControl } from '../field'

const props = withDefaults(defineProps<{
  type?: 'text' | 'email' | 'password' | 'search' | 'url' | 'tel' | 'number' | 'time'
  /** Overrides the id from `KitField`. */
  id?: string
  invalid?: boolean
}>(), {
  type: 'text',
})

const model = defineModel<string>({ default: '' })
const { id, describedBy, invalid, required } = useKitFieldControl(props)
const el = ref<HTMLInputElement | null>(null)

defineExpose({
  focus: () => el.value?.focus(),
})
</script>

<style src="../kit.css"></style>
