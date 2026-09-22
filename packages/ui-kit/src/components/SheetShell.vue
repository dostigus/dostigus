<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="kit-overlay" />
      <DialogContent
        :class="contentClass"
        v-bind="contentAttrs"
        @open-auto-focus="focusField"
      >
        <div
          v-if="kind === 'sheet' && edge !== 'end'"
          class="kit-handle"
          aria-hidden="true"
        />
        <header class="kit-head">
          <div>
            <DialogTitle class="kit-title">
              {{ title }}
            </DialogTitle>
            <DialogDescription
              v-if="description"
              class="kit-desc"
            >
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose
            class="kit-close"
            aria-label="Close"
          >
            Close
          </DialogClose>
        </header>
        <div
          v-if="$slots.media"
          class="kit-media"
        >
          <slot name="media" />
        </div>
        <div class="kit-body">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import type { SheetKind } from '@dostigus/shared'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  kind: SheetKind
  title: string
  description?: string
  edge?: 'bottom' | 'end'
}>(), {
  edge: 'bottom',
})

const open = defineModel<boolean>('open', { required: true })

const contentClass = computed(() => {
  if (props.kind !== 'sheet') {
    return 'kit-dialog'
  }
  return props.edge === 'end' ? 'kit-sheet kit-sheet--end' : 'kit-sheet'
})

const contentAttrs = computed(() => {
  if (props.description) {
    return {}
  }
  return { 'aria-describedby': undefined }
})

function focusField(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    return
  }
  const field = target.querySelector('input, textarea, select')
  if (!(field instanceof HTMLElement)) {
    return
  }
  event.preventDefault()
  field.focus()
}
</script>

<style src="../kit.css"></style>
