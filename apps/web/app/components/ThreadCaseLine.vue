<template>
  <button
    type="button"
    class="case-line"
    :class="{ empty: !value, bare: value && !summary }"
    :aria-label="ariaLabel"
    @click="emit('open')"
  >
    <template v-if="value">
      <KitChip
        class="status"
        :tone="value.status === 'done' ? 'ok' : 'neutral'"
      >
        {{ statusText }}
      </KitChip>
      <span
        v-if="summary"
        class="summary"
      >{{ summary }}</span>
    </template>
    <span
      v-else
      class="summary"
    >+ {{ $t('host.threadCase.add') }}</span>
  </button>
</template>

<script setup lang="ts">
import type { ThreadCase } from '@dostigus/shared'
import { KitChip } from '@dostigus/ui-kit'

const props = defineProps<{
  value: ThreadCase | null
}>()

const emit = defineEmits<{
  open: []
}>()

const { t } = useI18n()

const statusText = computed(() => (
  props.value?.status === 'done' ? t('host.threadCase.done') : t('host.threadCase.open')
))
const summary = computed(() => (
  props.value ? [props.value.label, props.value.nextAction].filter(Boolean).join(' · ') : ''
))
const ariaLabel = computed(() => (
  props.value
    ? t('host.threadCase.lineAria', { status: statusText.value, summary: summary.value || t('host.threadCase.noText') })
    : t('host.threadCase.lineAddAria')
))
</script>

<style scoped>
.case-line {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  max-width: 100%;
  appearance: none;
  border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  background: color-mix(in srgb, var(--sheet) 62%, transparent);
  backdrop-filter: blur(14px);
  color: var(--text);
  border-radius: 999px;
  padding: 0.14rem 0.6rem 0.14rem 0.2rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  line-height: 1.3;
}

.case-line.empty {
  padding-inline: 0.65rem;
  color: var(--text-muted);
}

.case-line.bare {
  padding-inline-end: 0.2rem;
}

.case-line:hover {
  background: color-mix(in srgb, var(--sheet) 78%, transparent);
}

.case-line.empty:hover {
  color: var(--text);
}

.case-line:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.status {
  flex: none;
  padding-block: 0.06rem;
  font-size: 0.72rem;
}

.summary {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
