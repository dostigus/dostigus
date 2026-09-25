<template>
  <form
    class="add"
    :class="{ first }"
    @submit.prevent="submit"
  >
    <div
      v-if="first"
      class="hero"
    >
      <GooseSticker
        name="think"
        size="sm"
        alt=""
      />
      <div>
        <h3>{{ $t('settings.providers.add.connectOpenRouter') }}</h3>
        <p class="hint">
          {{ $t('settings.providers.add.connectHint') }}
        </p>
      </div>
    </div>
    <div
      v-else
      class="add-head"
    >
      <h3>{{ $t('settings.providers.add.newProvider') }}</h3>
      <button
        type="button"
        class="close"
        :aria-label="$t('common.cancel')"
        @click="emit('cancel')"
      >
        ×
      </button>
    </div>

    <div
      v-if="!first || other"
      class="kinds"
      role="radiogroup"
      aria-label="Provider"
    >
      <button
        v-for="option in kindOptions"
        :key="option"
        type="button"
        role="radio"
        class="kind"
        :class="{ on: kind === option }"
        :aria-checked="kind === option"
        @click="kind = option"
      >
        {{ LLM_PROVIDER_KIND_LABELS[option] }}
      </button>
    </div>

    <label
      v-if="kind === 'openai-compatible'"
      class="field"
    >
      <span>{{ $t('settings.providers.add.baseUrl') }}</span>
      <input
        v-model="baseUrl"
        type="url"
        placeholder="https://api.example.com/v1"
        autocomplete="off"
        required
      >
    </label>

    <div class="key-row">
      <label class="field grow">
        <span>{{ kind === 'openrouter' ? $t('settings.providers.add.openRouterKey') : $t('settings.providers.add.apiKey') }}</span>
        <input
          v-model="apiKey"
          type="password"
          :placeholder="kind === 'openrouter' ? 'sk-or-v1-…' : 'sk-…'"
          autocomplete="new-password"
          spellcheck="false"
          required
        >
      </label>
      <KitButton
        v-if="kind === 'openrouter'"
        class="save"
        type="submit"
        :disabled="busy || !apiKey.trim()"
      >
        {{ busy ? $t('settings.providers.add.saving') : $t('settings.providers.add.save') }}
      </KitButton>
    </div>

    <label
      v-if="kind !== 'openrouter'"
      class="field"
    >
      <span>{{ $t('settings.providers.add.model') }}</span>
      <input
        v-model="defaultModel"
        type="text"
        :placeholder="kind === 'openai' ? OPENAI_SETTINGS_DEFAULT_MODEL : 'Model id'"
        autocomplete="off"
        spellcheck="false"
      >
      <span class="field-hint">{{ $t('settings.providers.add.modelHint') }}</span>
    </label>

    <div
      v-if="kind !== 'openrouter'"
      class="actions"
    >
      <KitButton
        type="submit"
        :disabled="busy || !apiKey.trim() || (kind === 'openai-compatible' && !baseUrl.trim())"
      >
        {{ busy ? $t('settings.providers.add.saving') : $t('settings.providers.add.save') }}
      </KitButton>
    </div>

    <p
      v-if="kind === 'openrouter'"
      class="where"
    >
      {{ $t('settings.providers.add.whereBefore') }}
      <a
        href="https://openrouter.ai/keys"
        target="_blank"
        rel="noopener noreferrer"
      >openrouter.ai/keys</a>{{ $t('settings.providers.add.whereAfter') }}
    </p>

    <button
      v-if="first && !other"
      type="button"
      class="link"
      @click="other = true"
    >
      {{ $t('settings.providers.add.otherOpenAI') }}
    </button>
  </form>
</template>

<script setup lang="ts">
import type { LlmProviderKind } from '@dostigus/shared'
import { LLM_PROVIDER_KIND_LABELS, LLM_PROVIDER_KINDS, OPENAI_SETTINGS_DEFAULT_MODEL } from '@dostigus/shared'
import { GooseSticker, KitButton } from '@dostigus/ui-kit'

defineProps<{
  first: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  add: [input: { kind: LlmProviderKind, apiKey: string, baseUrl: string, defaultModel: string }]
  cancel: []
}>()

const kindOptions = LLM_PROVIDER_KINDS
const kind = ref<LlmProviderKind>('openrouter')
const apiKey = ref('')
const baseUrl = ref('')
const defaultModel = ref('')
const other = ref(false)

function submit() {
  const key = apiKey.value.trim()
  if (!key) {
    return
  }
  emit('add', {
    kind: kind.value,
    apiKey: key,
    baseUrl: baseUrl.value.trim(),
    defaultModel: defaultModel.value.trim(),
  })
}

function reset() {
  apiKey.value = ''
  baseUrl.value = ''
  defaultModel.value = ''
}

defineExpose({ reset })
</script>

<style scoped>
.add {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.25rem 1.25rem 1.15rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--card);
}

.add.first {
  padding: 1.5rem 1.4rem 1.3rem;
  border-color: color-mix(in srgb, var(--accent) 35%, var(--line));
}

.hero {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.hero :deep(img) {
  flex: none;
}

h3 {
  margin: 0 0 0.25rem;
  font-size: 1.15rem;
}

.hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.add-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.close {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}

.close:hover {
  color: var(--text);
}

.kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.kind {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text-muted);
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.kind.on {
  border-color: transparent;
  background: color-mix(in srgb, var(--accent) 22%, var(--surface));
  color: var(--accent-ink);
}

.key-row {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.grow {
  flex: 1;
  min-width: 0;
}

.field-hint {
  font-size: 0.76rem;
}

input {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.9rem;
}

input:focus {
  outline: 1px solid var(--accent-dim);
}

.save {
  flex: none;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.where {
  margin: -0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.where a {
  color: var(--text);
}

.link {
  appearance: none;
  align-self: flex-start;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--text-muted);
  text-decoration: underline;
  text-underline-offset: 2px;
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}

.link:hover {
  color: var(--text);
}

@media (max-width: 30rem) {
  .key-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
