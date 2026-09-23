<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="kit-overlay"
        :class="{ 'kit-overlay--modal': kind === 'modal' }"
      />
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
        <header
          v-if="chrome !== 'bare'"
          class="kit-head"
          :class="{ 'kit-head--center': titleAlign === 'center' }"
        >
          <div class="kit-head-copy">
            <DialogTitle class="kit-title">
              <slot name="title">
                {{ title }}
              </slot>
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
            :class="{ 'kit-close--icon': close === 'icon' }"
            aria-label="Close"
          >
            {{ close === 'icon' ? '×' : 'Close' }}
          </DialogClose>
        </header>
        <DialogTitle
          v-else
          class="kit-sr-only"
        >
          {{ title }}
        </DialogTitle>
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
  /** Wider centered Sheet. Drawers ignore this. */
  wide?: boolean
  /** Center the title. The close control stays in the top-right. */
  titleAlign?: 'start' | 'center'
  /** `text` says Close. `icon` is the Host ×. */
  close?: 'text' | 'icon'
  /** `bare` keeps an accessible name and drops the title and close control. */
  chrome?: 'default' | 'bare'
}>(), {
  edge: 'bottom',
  wide: false,
  titleAlign: 'start',
  close: 'text',
  chrome: 'default',
})

const open = defineModel<boolean>('open', { required: true })

const contentClass = computed(() => {
  if (props.kind !== 'sheet') {
    const classes = ['kit-dialog']
    if (props.wide) {
      classes.push('kit-dialog--wide')
    }
    if (props.chrome === 'bare') {
      classes.push('kit-dialog--bare')
    }
    return classes.join(' ')
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
