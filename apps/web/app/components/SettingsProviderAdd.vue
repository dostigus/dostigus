<template>
  <KitPanel
    as="form"
    class="add"
    :title="first ? undefined : $t('settings.providers.add.newProvider')"
    :heading-level="3"
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
      v-if="!first || other"
      class="kinds"
      role="radiogroup"
      aria-label="Provider"
    >
      <KitChip
        v-for="option in kindOptions"
        :key="option"
        as="button"
        role="radio"
        :selected="kind === option"
        :aria-checked="kind === option"
        @click="kind = option"
      >
        {{ LLM_PROVIDER_KIND_LABELS[option] }}
      </KitChip>
    </div>

    <KitField
      v-if="kind === 'openai-compatible'"
      :label="$t('settings.providers.add.baseUrl')"
      :error="errorOn('baseUrl')"
      required
    >
      <KitInput
        v-model="baseUrl"
        type="url"
        placeholder="https://api.example.com/v1"
        autocomplete="off"
      />
    </KitField>

    <KitField
      :label="kind === 'openrouter' ? $t('settings.providers.add.openRouterKey') : $t('settings.providers.add.apiKey')"
      :error="errorOn('apiKey')"
      required
    >
      <KitInput
        v-model="apiKey"
        type="password"
        :placeholder="kind === 'openrouter' ? 'sk-or-v1-…' : 'sk-…'"
        autocomplete="new-password"
        spellcheck="false"
      />
      <template
        v-if="kind === 'openrouter'"
        #hint
      >
        {{ $t('settings.providers.add.whereBefore') }}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
        >openrouter.ai/keys</a>{{ $t('settings.providers.add.whereAfter') }}
      </template>
    </KitField>

    <KitField
      v-if="kind !== 'openrouter'"
      :label="$t('settings.providers.add.model')"
      :hint="$t('settings.providers.add.modelHint')"
      :error="errorOn('model')"
    >
      <KitInput
        v-model="defaultModel"
        :placeholder="kind === 'openai' ? OPENAI_SETTINGS_DEFAULT_MODEL : $t('settings.providers.add.modelId')"
        autocomplete="off"
        spellcheck="false"
      />
    </KitField>

    <template #actions>
      <KitButton
        v-if="first && !other"
        class="other"
        variant="ghost"
        size="sm"
        @click="other = true"
      >
        {{ $t('settings.providers.add.otherOpenAI') }}
      </KitButton>
      <KitButton
        v-if="!first"
        variant="ghost"
        @click="emit('cancel')"
      >
        {{ $t('common.cancel') }}
      </KitButton>
      <KitButton
        type="submit"
        :disabled="busy || !apiKey.trim() || (kind === 'openai-compatible' && !baseUrl.trim())"
      >
        {{ busy ? $t('settings.providers.add.saving') : $t('settings.providers.add.save') }}
      </KitButton>
    </template>
  </KitPanel>
</template>

<script setup lang="ts">
import type { LlmProviderKind } from '@dostigus/shared'
import type { ProviderFormField } from '../utils/provider-settings'
import { LLM_PROVIDER_KIND_LABELS, LLM_PROVIDER_KINDS, OPENAI_SETTINGS_DEFAULT_MODEL } from '@dostigus/shared'
import { GooseSticker, KitButton, KitChip, KitField, KitInput, KitPanel } from '@dostigus/ui-kit'
import { providerErrorField } from '../utils/provider-settings'

const props = defineProps<{
  first: boolean
  busy: boolean
  /** The last failed save. The typed values stay. */
  error?: string
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

function errorOn(field: ProviderFormField): string | undefined {
  return props.error && providerErrorField(props.error, kind.value) === field ? props.error : undefined
}

function submit() {
  const key = apiKey.value.trim()
  if (!key) {
    return
  }
  emit('add', {
    kind: kind.value,
    apiKey: key,
    baseUrl: kind.value === 'openai-compatible' ? baseUrl.value.trim() : '',
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

.kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.add a {
  color: var(--text);
}

.other {
  margin-right: auto;
}
</style>
