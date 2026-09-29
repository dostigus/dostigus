<template>
  <div class="composer-foot">
    <div
      ref="rowEl"
      class="composer-row"
      :class="{ multiline, 'has-lead': attach }"
      @input="scheduleMeasure"
    >
      <slot name="tray" />
      <div class="composer-line">
        <button
          v-if="attach"
          type="button"
          class="attach"
          :disabled="attachDisabled"
          :aria-label="$t('chat.aria.attach')"
          :title="$t('chat.aria.attach')"
          @click="emit('attach')"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <slot />
        <button
          v-if="showSend"
          type="submit"
          class="send"
          :disabled="sendDisabled"
          :aria-label="$t('chat.aria.send')"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 19V6M7 11l5-5 5 5" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Force the concentric corner, for content above the field such as the attachment tray. */
  tall?: boolean
  attach?: boolean
  attachDisabled?: boolean
  showSend?: boolean
  sendDisabled?: boolean
}>(), {
  tall: false,
  attach: false,
  attachDisabled: false,
  showSend: false,
  sendDisabled: false,
})

const emit = defineEmits<{ attach: [] }>()

const rowEl = ref<HTMLElement | null>(null)
const multiline = ref(false)
let radiusTicket = 0
let fieldObserver: ResizeObserver | null = null

function field(): HTMLTextAreaElement | null {
  return rowEl.value?.querySelector('textarea') ?? null
}

/**
 * Pill on one line; a concentric corner once the field is taller than that
 * or the tray sits inside the row.
 */
function measure() {
  if (props.tall) {
    setMultiline(true)
    return
  }
  const el = field()
  if (!el) {
    setMultiline(false)
    return
  }
  const style = getComputedStyle(el)
  const line = Number.parseFloat(style.lineHeight)
  const pad = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
  if (!Number.isFinite(line) || line <= 0) {
    setMultiline(el.value.includes('\n'))
    return
  }
  const oneLine = line + (Number.isFinite(pad) ? pad : 0)
  setMultiline(el.scrollHeight > oneLine + line * 0.5)
}

function scheduleMeasure() {
  nextTick(measure)
}

/**
 * `9999px` eased toward the concentric corner stays a pill until the last
 * frame, so the transition starts from the corner already on screen (half
 * the row).
 */
function setMultiline(next: boolean) {
  if (next === multiline.value) {
    return
  }
  const row = rowEl.value
  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!row || reduce) {
    if (row) {
      row.style.transition = ''
      row.style.borderRadius = ''
    }
    multiline.value = next
    return
  }
  const ticket = ++radiusTicket
  row.style.transition = 'none'
  row.style.borderRadius = `${row.getBoundingClientRect().height / 2}px`
  multiline.value = next
  nextTick(() => {
    if (ticket !== radiusTicket || !row.isConnected) {
      return
    }
    void row.offsetWidth
    row.style.transition = ''
    row.style.borderRadius = ''
  })
}

onMounted(() => {
  measure()
  const el = field()
  if (el && typeof ResizeObserver !== 'undefined') {
    fieldObserver = new ResizeObserver(() => {
      measure()
    })
    fieldObserver.observe(el)
  }
})

onUnmounted(() => {
  fieldObserver?.disconnect()
})

watch(() => props.tall, scheduleMeasure)
</script>

<style scoped>
/* Footer band: only the bottom half of the row, plus a hair past its
   edge. The used corner never passes the midline, so this seals the lower
   pockets and the strip under the field without filling the top pockets. */
.composer-foot {
  position: relative;
}

.composer-foot::before {
  content: "";
  position: absolute;
  z-index: 0;
  left: 0;
  right: 0;
  top: 50%;
  bottom: -2px;
  background: var(--bg-chat);
  pointer-events: none;
}

.composer-row {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  --composer-button: 2.25rem;
  --composer-pad: 0.3rem;
  --composer-rim: 1px;
  /* Anything inset by --composer-pad shares the button bend, so the
     outer corner is that bend plus the pad and the rim (concentric).
     On one line that is exactly half the row, so the pill and the
     multiline corner meet without a jump. */
  --composer-inner-radius: calc(var(--composer-button) / 2);
  gap: var(--composer-pad);
  overflow: hidden;
  /* Equal on every side so each circle sits concentric with its end cap. */
  padding: var(--composer-pad);
  border: var(--composer-rim) solid var(--composer-line);
  border-radius: 9999px;
  background: var(--composer);
  pointer-events: auto;
  /* Corner and fill share one clock so the stroke does not hitch; the rim
     answers hover and focus on its own short step. */
  transition-property: border-radius, border-color, background-color;
  transition-duration: 640ms, 160ms, 640ms;
  transition-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
}

.composer-row:hover,
.composer-row:focus-within {
  border-color: var(--composer-line-strong);
}

.composer-row.multiline {
  border-radius: calc(var(--composer-inner-radius) + var(--composer-pad) + var(--composer-rim));
}

.composer-line {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.composer-row.multiline .composer-line {
  align-items: flex-end;
}

.attach,
.send {
  appearance: none;
  display: grid;
  place-items: center;
  width: var(--composer-button);
  height: var(--composer-button);
  flex: none;
  border: 0;
  border-radius: 999px;
  padding: 0;
  cursor: pointer;
}

/* Ghost twin of Send: same circle, its own soft fill and a hairline rim
   drawn inside so the footprint stays exactly the Send diameter. */
.attach {
  background: color-mix(in srgb, var(--text) 9%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 14%, transparent);
  color: var(--text);
  transition: background-color 160ms ease;
}

.attach:hover:not(:disabled) {
  background: color-mix(in srgb, var(--text) 16%, transparent);
}

.attach:focus-visible,
.send:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.attach:disabled,
.send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.send {
  background: var(--accent);
  color: var(--accent-ink);
}

.send:hover:not(:disabled) {
  filter: brightness(1.05);
}

.attach svg,
.send svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.composer-line > :slotted(.draft) {
  flex: 1;
  min-width: 0;
  display: flex;
}

.composer-line :slotted(textarea) {
  width: 100%;
  resize: none;
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  /* One line is exactly the 2.25rem button box: 1.45rem + 2 × 0.4rem. */
  padding: 0.4rem 0.25rem;
  line-height: 1.45rem;
  min-height: 2.25rem;
  max-height: 8rem;
  field-sizing: content;
}

/* With no Attach circle the text clears the end cap instead. */
.composer-row:not(.has-lead) .composer-line :slotted(textarea) {
  padding-left: 0.85rem;
}

.composer-line :slotted(textarea:focus) {
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  .composer-row,
  .attach {
    transition: none;
  }
}
</style>
