<template>
  <ul
    v-if="items.length"
    class="pending-chips"
    :aria-label="$t('chat.aria.attachments')"
  >
    <li
      v-for="item in items"
      :key="item.localId"
      class="pending-chip"
      :class="[item.status, { image: item.previewUrl }]"
      :title="item.error ?? item.filename"
    >
      <img
        v-if="item.previewUrl"
        :src="item.previewUrl"
        :alt="item.filename"
        class="pending-thumb"
      >
      <template v-else>
        <span
          class="pending-icon"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
          </svg>
        </span>
        <span class="pending-copy">
          <span class="pending-name">{{ item.filename }}</span>
          <span class="pending-meta">{{ pendingMeta(item) }}</span>
        </span>
      </template>
      <span
        v-if="item.previewUrl && item.status !== 'ready'"
        class="pending-veil"
      >{{ item.status === 'uploading' ? $t('chat.attachments.uploading') : $t('chat.attachments.failed') }}</span>
      <button
        type="button"
        class="pending-remove"
        :aria-label="$t('chat.attachments.remove', { file: item.filename })"
        @click="emit('remove', item.localId)"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      </button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { PendingAttachment } from '../composables/useComposerAttachments'
import { formatArtifactBytes } from '@dostigus/shared'

defineProps<{
  items: PendingAttachment[]
}>()

const emit = defineEmits<{ remove: [localId: string] }>()

const { t } = useI18n()

function pendingMeta(item: PendingAttachment) {
  if (item.status === 'uploading') {
    return t('chat.attachments.uploading')
  }
  if (item.status === 'error') {
    return item.error ?? t('chat.attachments.failed')
  }
  return formatArtifactBytes(item.byteSize)
}
</script>

<style scoped>
.pending-chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.45rem;
}

.pending-chip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  max-width: 15rem;
  height: 3.5rem;
  --chip-inset: 0.625rem;
  padding: 0 2rem 0 var(--chip-inset);
  border-radius: var(--composer-inner-radius);
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
  background: color-mix(in srgb, var(--text) 4%, transparent);
  font-size: 0.82rem;
}

.pending-chip.image {
  width: 3.5rem;
  padding: 0;
  overflow: hidden;
}

.pending-chip.error {
  border-color: var(--accent);
}

.pending-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pending-chip.uploading .pending-thumb {
  opacity: 0.55;
}

.pending-veil {
  position: absolute;
  inset: auto 0 0;
  padding: 0.1rem 0;
  text-align: center;
  font-size: 0.62rem;
  background: color-mix(in srgb, var(--bg-chat) 70%, transparent);
  color: var(--text);
}

.pending-chip.error .pending-veil {
  color: var(--accent);
}

.pending-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: calc(var(--composer-inner-radius) - var(--chip-inset));
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}

.pending-icon svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.9;
  stroke-linejoin: round;
}

.pending-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.pending-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-weight: 600;
}

.pending-meta {
  color: var(--text-muted);
  font-size: 0.74rem;
  white-space: nowrap;
}

.pending-chip.error .pending-meta {
  color: var(--accent);
}

.pending-remove {
  appearance: none;
  position: absolute;
  top: calc(var(--composer-inner-radius) - 0.65rem);
  right: calc(var(--composer-inner-radius) - 0.65rem);
  display: grid;
  place-items: center;
  width: 1.3rem;
  height: 1.3rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-chat) 72%, transparent);
  color: var(--text);
  cursor: pointer;
}

.pending-remove:hover {
  background: var(--bg-chat);
}

.pending-remove:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.pending-remove svg {
  width: 0.8rem;
  height: 0.8rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.4;
  stroke-linecap: round;
}
</style>
