<template>
  <div class="shell">
    <header class="top">
      <div>
        <NuxtLink
          to="/"
          class="back"
        >
          Bots
        </NuxtLink>
        <p class="mark">
          Settings
        </p>
        <p class="sub">
          LLM gateway
        </p>
      </div>
    </header>

    <main class="stage">
      <p
        v-if="loadError"
        class="banner"
      >
        Could not load LLM gateway settings.
      </p>

      <form
        class="card"
        @submit.prevent="save"
      >
        <div class="status-row">
          <span
            class="badge"
            :class="gateway?.configured ? 'on' : 'off'"
          >
            {{ gateway?.configured ? 'Connected' : 'Disconnected' }}
          </span>
          <span
            v-if="gateway?.apiKeyMasked"
            class="mask"
          >
            Key {{ gateway.apiKeyMasked }}
          </span>
        </div>
        <p
          v-if="gateway?.envOverride"
          class="note"
        >
          Compose env is overriding the Store until those variables are unset.
        </p>
        <p class="hint">
          Paste an OpenRouter or OpenAI-compatible base URL and key. The key
          stays in the Cluster Store (server-side only) and is never shown in
          full.
        </p>

        <label class="field">
          <span>Base URL</span>
          <input
            v-model="baseUrl"
            type="url"
            placeholder="https://openrouter.ai/api/v1"
            autocomplete="off"
          >
        </label>

        <label class="field">
          <span>API key</span>
          <input
            v-model="apiKey"
            type="password"
            :placeholder="keyPlaceholder"
            autocomplete="new-password"
          >
        </label>

        <label class="field">
          <span>Default Model tier</span>
          <select v-model="defaultTier">
            <option
              v-for="tier in tiers"
              :key="tier"
              :value="tier"
            >
              {{ tier }}
            </option>
          </select>
        </label>

        <fieldset class="overrides">
          <legend>Model overrides (optional)</legend>
          <label
            v-for="tier in tiers"
            :key="tier"
            class="field"
          >
            <span>{{ tier }}</span>
            <input
              v-model="modelOverrides[tier]"
              type="text"
              :placeholder="gateway?.defaultModels[tier]"
              autocomplete="off"
            >
          </label>
        </fieldset>

        <p
          v-if="message"
          class="flash"
          :class="{ error: messageError }"
        >
          {{ message }}
        </p>

        <div class="actions">
          <button
            type="button"
            class="ghost"
            :disabled="busy || !gateway?.configured"
            @click="ping"
          >
            {{ pinging ? 'Pinging…' : 'Test ping' }}
          </button>
          <button
            v-if="gateway?.hasStoredApiKey"
            type="button"
            class="ghost"
            :disabled="busy"
            @click="clearKey"
          >
            Remove stored key
          </button>
          <button
            type="submit"
            class="solid"
            :disabled="busy"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { LlmGatewayPublic, ModelTier } from '@dostigus/shared'
import { MODEL_TIERS } from '@dostigus/shared'

useHead({ title: 'Dostigus · Settings' })

const tiers = MODEL_TIERS
const { data, error: loadError, refresh } = await useFetch<{ llmGateway: LlmGatewayPublic }>(
  '/api/settings/llm-gateway',
)

const gateway = computed(() => data.value?.llmGateway)
const baseUrl = ref('')
const apiKey = ref('')
const defaultTier = ref<ModelTier>('strong')
const modelOverrides = ref<Partial<Record<ModelTier, string>>>({})
const saving = ref(false)
const pinging = ref(false)
const message = ref('')
const messageError = ref(false)

const busy = computed(() => saving.value || pinging.value)
const keyPlaceholder = computed(() => {
  if (gateway.value?.apiKeyMasked) {
    return `${gateway.value.apiKeyMasked} — paste to replace`
  }
  return 'Paste key'
})

function applyGateway(next?: LlmGatewayPublic) {
  if (!next) {
    return
  }
  baseUrl.value = next.baseUrl ?? ''
  apiKey.value = ''
  defaultTier.value = next.defaultTier
  modelOverrides.value = { ...next.modelOverrides }
}

watch(gateway, (next) => applyGateway(next), { immediate: true })

async function save() {
  saving.value = true
  message.value = ''
  messageError.value = false
  try {
    const result = await $fetch<{ llmGateway: LlmGatewayPublic }>('/api/settings/llm-gateway', {
      method: 'PUT',
      body: {
        baseUrl: baseUrl.value.trim() || null,
        apiKey: apiKey.value.trim() || undefined,
        defaultTier: defaultTier.value,
        modelOverrides: modelOverrides.value,
      },
    })
    data.value = result
    applyGateway(result.llmGateway)
    message.value = result.llmGateway.configured
      ? 'LLM gateway saved.'
      : 'Saved. Add a key to leave stub replies.'
  } catch {
    message.value = 'Could not save LLM gateway settings.'
    messageError.value = true
  } finally {
    saving.value = false
  }
}

async function clearKey() {
  saving.value = true
  message.value = ''
  messageError.value = false
  try {
    const result = await $fetch<{ llmGateway: LlmGatewayPublic }>('/api/settings/llm-gateway', {
      method: 'PUT',
      body: { clearApiKey: true },
    })
    data.value = result
    applyGateway(result.llmGateway)
    message.value = 'Stored key removed.'
  } catch {
    message.value = 'Could not remove the stored key.'
    messageError.value = true
  } finally {
    saving.value = false
  }
}

async function ping() {
  pinging.value = true
  message.value = ''
  messageError.value = false
  try {
    const result = await $fetch<{ ok: boolean, error?: string }>(
      '/api/settings/llm-gateway/ping',
      { method: 'POST' },
    )
    if (result.ok) {
      message.value = 'Ping ok.'
      return
    }
    message.value = result.error ?? 'Ping failed.'
    messageError.value = true
  } catch {
    message.value = 'Ping failed.'
    messageError.value = true
  } finally {
    pinging.value = false
    await refresh()
  }
}
</script>

<style scoped>
.shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.top {
  padding: 1.15rem 1.4rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.back {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.9rem;
}

.mark {
  margin: 0.35rem 0 0;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
}

.sub {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.stage {
  flex: 1;
  padding: 1.5rem 1.4rem 3rem;
}

.banner {
  margin: 0 0 1rem;
  color: var(--accent);
}

.card {
  max-width: 32rem;
  margin: 0 auto;
  padding: 1.35rem 1.35rem 1.4rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.status-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.7rem;
  border-radius: 999px;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
}

.badge.on {
  background: color-mix(in srgb, var(--accent) 22%, var(--surface));
  color: var(--accent-ink);
}

.badge.off {
  background: var(--bg);
  color: var(--text-muted);
  border: 1px solid var(--line);
}

.mask,
.note,
.hint {
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.45;
}

.note,
.hint {
  margin: 0 0 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

input,
select {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.7rem 0.85rem;
}

input:focus,
select:focus {
  outline: 1px solid var(--accent-dim);
}

.overrides {
  margin: 0.4rem 0 1rem;
  padding: 0.85rem 0.9rem 0.2rem;
  border: 1px dashed var(--line);
  border-radius: var(--radius-sm);
}

legend {
  padding: 0 0.3rem;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.flash {
  margin: 0 0 1rem;
  color: var(--text);
  font-size: 0.9rem;
}

.flash.error {
  color: var(--accent);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.55rem;
}

.ghost,
.solid {
  appearance: none;
  border-radius: 999px;
  padding: 0.5rem 0.95rem;
  cursor: pointer;
}

.ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
}

.solid {
  border: 0;
  background: var(--accent);
  color: var(--accent-ink);
}

.ghost:disabled,
.solid:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
