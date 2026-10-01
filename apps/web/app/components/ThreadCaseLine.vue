<template>
  <button
    type="button"
    class="case-line"
    :class="{ empty: !value, bare: value && !summary && !followUp }"
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
      <span
        v-if="followUp"
        class="follow"
      >{{ followUp }}</span>
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
import { scheduleWhenLabel } from '../utils/schedule-copy'

const props = defineProps<{
  value: ThreadCase | null
  /** Cluster timezone for the follow-up time. */
  timeZone?: string
}>()

const emit = defineEmits<{
  open: []
}>()

const { t, locale } = useI18n()

const followUp = computed(() => {
  if (!props.value?.followUpAt) {
    return ''
  }
  const when = scheduleWhenLabel(
    props.value.followUpAt,
    props.timeZone || 'UTC',
    Date.now(),
    locale.value === 'ru' ? 'ru' : 'en',
  )
  return t('host.threadCase.followUpLine', { when })
})

const statusText = computed(() => (
  props.value?.status === 'done' ? t('host.threadCase.done') : t('host.threadCase.open')
))
const summary = computed(() => (
  props.value ? [props.value.label, props.value.nextAction].filter(Boolean).join(' · ') : ''
))
const ariaLabel = computed(() => {
  if (!props.value) {
    return t('host.threadCase.lineAddAria')
  }
  const base = t('host.threadCase.lineAria', {
    status: statusText.value,
    summary: summary.value || t('host.threadCase.noText'),
  })
  return followUp.value ? `${followUp.value}. ${base}` : base
})
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

.follow {
  flex: none;
  color: var(--text-muted);
  white-space: nowrap;
}

.summary + .follow::before {
  content: '·';
  margin-inline-end: 0.4rem;
}
</style>
