<template>
  <textarea
    :id="id"
    v-model="model"
    class="kit-input kit-input--multiline"
    :rows="rows"
    :aria-describedby="describedBy"
    :aria-invalid="invalid || undefined"
    :required="required || undefined"
  />
</template>

<script setup lang="ts">
import { useKitFieldControl } from '../field'

const props = withDefaults(defineProps<{
  rows?: number
  /** Overrides the id from `KitField`. */
  id?: string
  invalid?: boolean
}>(), {
  rows: 4,
})

const model = defineModel<string>({ default: '' })
const { id, describedBy, invalid, required } = useKitFieldControl(props)
</script>

<style src="../kit.css"></style>
