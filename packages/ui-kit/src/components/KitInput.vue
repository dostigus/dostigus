<template>
  <input
    :id="id"
    v-model="model"
    class="kit-input"
    :type="type"
    :aria-describedby="describedBy"
    :aria-invalid="invalid || undefined"
    :required="required || undefined"
  >
</template>

<script setup lang="ts">
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
</script>

<style src="../kit.css"></style>
