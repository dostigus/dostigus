<template>
  <div class="card">
    <p class="prompt">
      {{ $t('chat.purpose.prompt') }}
    </p>
    <p class="hint">
      {{ $t('chat.purpose.hint') }}
    </p>
    <div
      class="chips"
      role="group"
      :aria-label="$t('chat.purpose.prompt')"
    >
      <button
        v-for="option in BOT_PURPOSE_OPTIONS"
        :key="option"
        type="button"
        class="chip"
        :disabled="busy"
        @click="emit('answer', option)"
      >
        {{ purposeLabel(option) }}
      </button>
    </div>
    <form
      class="own"
      @submit.prevent="submit"
    >
      <label class="field">
        <span class="sr-only">{{ $t('chat.purpose.own') }}</span>
        <input
          v-model="draft"
          type="text"
          maxlength="16000"
          :placeholder="$t('chat.purpose.own')"
          :disabled="busy"
          autocomplete="off"
        >
      </label>
      <button
        v-if="draft.trim()"
        type="submit"
        class="send"
        :disabled="busy"
        :aria-label="$t('chat.purpose.send')"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 19V6M7 11l5-5 5 5" />
        </svg>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { BOT_PURPOSE_OPTIONS } from '@dostigus/shared'

const PURPOSE_KEYS = {
  Personal: 'chat.purpose.personal',
  Work: 'chat.purpose.work',
  Learning: 'chat.purpose.learning',
  Other: 'chat.purpose.other',
} as const

const { t } = useI18n()

function purposeLabel(option: (typeof BOT_PURPOSE_OPTIONS)[number]): string {
  return t(PURPOSE_KEYS[option])
}

defineProps<{
  busy?: boolean
}>()

const emit = defineEmits<{
  answer: [content: string]
}>()

const draft = ref('')

function submit() {
  const content = draft.value.trim()
  if (!content) {
    return
  }
  emit('answer', content)
}
</script>

<style scoped>
.card {
  align-self: flex-start;
  width: min(34rem, 100%);
  padding: 0.95rem 1rem 0.85rem;
  border-radius: var(--radius-card);
  background: var(--sheet);
  border: 1px solid var(--line);
}

.prompt {
  margin: 0;
  font-weight: 700;
  font-size: 1.02rem;
}

.hint {
  margin: 0.25rem 0 0.8rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.chip {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg-chat);
  color: var(--text);
  border-radius: 999px;
  padding: 0.4rem 0.85rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.chip:hover:not(:disabled) {
  border-color: var(--accent);
}

.chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.chip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.own {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.8rem;
  padding: 0.2rem 0.25rem 0.2rem 0.85rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg-chat);
}

.field {
  flex: 1;
  min-width: 0;
  display: flex;
}

.own input {
  width: 100%;
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text);
  padding: 0.45rem 0;
  font: inherit;
}

.own input:focus {
  outline: none;
}

.send {
  appearance: none;
  display: grid;
  place-items: center;
  width: 2.15rem;
  height: 2.15rem;
  flex: none;
  border: 0;
  border-radius: 999px;
  padding: 0;
  background: var(--accent);
  color: var(--accent-ink);
  cursor: pointer;
}

.send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.send svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
