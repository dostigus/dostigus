<template>
  <div class="page">
    <header class="top">
      <HostMenuButton />
      <div>
        <p class="mark">
          Settings
        </p>
        <p class="sub">
          Providers
        </p>
      </div>
    </header>

    <main class="stage">
      <p
        v-if="loadError"
        class="banner"
      >
        Could not load Settings.
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
            {{ gateway?.configured ? 'Ready' : 'No key yet' }}
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
          A key is already set on the server. Saving here will not change
          replies until that server key is removed.
        </p>
        <p class="hint">
          {{ hint }}
        </p>

        <div
          v-if="providers.length > 0"
          class="provider-list"
        >
          <article
            v-for="provider in providers"
            :key="provider.id"
            class="provider"
          >
            <div class="status-row">
              <span class="mask">{{ kindLabel(provider.kind) }}</span>
              <span
                v-if="provider.apiKeyMasked || provider.hasApiKey"
                class="mask"
              >
                Key {{ provider.apiKeyMasked ?? 'stored' }}
              </span>
              <button
                type="button"
                class="ghost tiny"
                :disabled="providers.length < 2 || busy"
                @click="removeProvider(provider.id)"
              >
                Remove
              </button>
            </div>
            <label class="field">
              <span>Kind</span>
              <select
                :value="provider.kind"
                @change="onProviderKind(provider.id, ($event.target as HTMLSelectElement).value)"
              >
                <option
                  v-for="kind in kinds"
                  :key="kind"
                  :value="kind"
                >
                  {{ kindLabel(kind) }}
                </option>
              </select>
            </label>
            <label
              v-if="provider.kind === 'openai-compatible'"
              class="field"
            >
              <span>Base URL</span>
              <input
                v-model="provider.baseUrl"
                type="url"
                placeholder="https://api.example.com/v1"
                autocomplete="off"
              >
            </label>
            <label class="field">
              <span>API key</span>
              <input
                v-model="provider.apiKey"
                type="password"
                :placeholder="providerKeyPlaceholder(provider)"
                autocomplete="new-password"
              >
            </label>
            <label
              v-if="provider.kind !== 'openrouter'"
              class="field"
            >
              <span>Model</span>
              <input
                v-model="provider.defaultModel"
                type="text"
                :placeholder="provider.kind === 'openai' ? 'gpt-4o' : 'Model id'"
                autocomplete="off"
              >
            </label>
          </article>
        </div>

        <details
          class="advanced"
          :open="providers.length === 0"
        >
          <summary>{{ providers.length === 0 ? 'Add a Provider' : 'Add another Provider' }}</summary>
          <div
            class="presets"
            role="radiogroup"
            aria-label="Provider kind"
          >
            <button
              v-for="kind in kinds"
              :key="kind"
              type="button"
              class="preset"
              :class="{ on: addKind === kind }"
              :aria-checked="addKind === kind"
              role="radio"
              @click="addKind = kind"
            >
              {{ kindLabel(kind) }}
            </button>
          </div>
          <label
            v-if="addKind === 'openai-compatible'"
            class="field"
          >
            <span>Base URL</span>
            <input
              v-model="addBaseUrl"
              type="url"
              placeholder="https://api.example.com/v1"
              autocomplete="off"
            >
          </label>
          <label class="field">
            <span>API key</span>
            <input
              v-model="addApiKey"
              type="password"
              :placeholder="addKind === 'openrouter' ? 'Paste your OpenRouter key' : 'Paste your API key'"
              autocomplete="new-password"
            >
          </label>
          <label
            v-if="addKind !== 'openrouter'"
            class="field"
          >
            <span>Model</span>
            <input
              v-model="addDefaultModel"
              type="text"
              :placeholder="addKind === 'openai' ? 'gpt-4o' : 'Model id'"
              autocomplete="off"
            >
          </label>
          <div class="actions">
            <button
              type="button"
              class="ghost"
              :disabled="busy || !addApiKey.trim()"
              @click="addProvider"
            >
              Add Provider
            </button>
          </div>
        </details>

        <div
          v-if="providers.length > 0"
          class="tiers"
        >
          <p class="mark">
            Model tiers
          </p>
          <p class="hint">
            Chat starts on Strong. A Wake starts on Cheap. Code is an escalate step.
          </p>
          <label
            v-for="tier in tiers"
            :key="tier"
            class="field"
          >
            <span>{{ MODEL_TIER_LABELS[tier] }}</span>
            <select
              :value="tierBinds[tier]?.providerId ?? ''"
              @change="onTierProvider(tier, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">
                Unset
              </option>
              <option
                v-for="provider in providers"
                :key="provider.id"
                :value="provider.id"
              >
                {{ kindLabel(provider.kind) }}
              </option>
            </select>
            <select
              v-if="tierBinds[tier] && providerKind(tierBinds[tier]?.providerId) === 'openrouter'"
              :value="tierBinds[tier]?.policy.kind ?? 'auto'"
              @change="onTierPolicy(tier, ($event.target as HTMLSelectElement).value)"
            >
              <option value="free">
                Free
              </option>
              <option value="auto">
                Auto
              </option>
            </select>
          </label>
        </div>

        <details
          v-if="hasLegacyPins"
          class="advanced"
        >
          <summary>Stored model ids</summary>
          <label
            v-for="tier in tiers"
            :key="tier"
            class="field"
          >
            <span>{{ MODEL_TIER_LABELS[tier] }}</span>
            <input
              v-model="modelOverrides[tier]"
              type="text"
              :placeholder="gateway?.defaultModels[tier]"
              autocomplete="off"
            >
          </label>
        </details>

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
            {{ pinging ? 'Checking…' : 'Test connection' }}
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

      <form
        class="card tz"
        @submit.prevent="saveTimezone"
      >
        <p class="mark">
          Cluster timezone
        </p>
        <p class="hint">
          Schedules use this wall clock. An IANA name such as America/New_York or UTC.
        </p>
        <p
          v-if="timezone?.source === 'env'"
          class="note"
        >
          Using {{ timezone.effective }} from the server until you save a timezone here.
        </p>
        <p
          v-else-if="timezone && !timezone.stored"
          class="note"
        >
          Using UTC until you set a timezone.
        </p>
        <label class="field">
          <span>IANA timezone</span>
          <input
            v-model="timezoneInput"
            type="text"
            name="timezone"
            placeholder="America/New_York"
            autocomplete="off"
            spellcheck="false"
          >
        </label>
        <p
          v-if="timezoneMessage"
          class="flash"
          :class="{ error: timezoneMessageError }"
        >
          {{ timezoneMessage }}
        </p>
        <div class="actions">
          <button
            type="submit"
            class="solid"
            :disabled="timezoneSaving || !timezoneInput.trim()"
          >
            {{ timezoneSaving ? 'Saving…' : 'Save timezone' }}
          </button>
        </div>
      </form>

      <form
        class="card tz"
        @submit.prevent="saveAllowlist"
      >
        <p class="mark">
          Cluster http allowlist
        </p>
        <p class="hint">
          Hostnames Host HTTP get may reach. One hostname per line, exact match,
          no wildcards. Empty allows every public host. Loopback and private
          addresses stay blocked.
        </p>
        <p
          v-if="allowlist && allowlist.length === 0"
          class="note"
        >
          Empty — Bots may GET any public host.
        </p>
        <label class="field">
          <span>Hostnames</span>
          <textarea
            v-model="allowlistInput"
            name="http-allowlist"
            rows="4"
            placeholder="api.open-meteo.com"
            autocomplete="off"
            spellcheck="false"
          />
        </label>
        <p
          v-if="allowlistMessage"
          class="flash"
          :class="{ error: allowlistMessageError }"
        >
          {{ allowlistMessage }}
        </p>
        <div class="actions">
          <button
            type="submit"
            class="solid"
            :disabled="allowlistSaving"
          >
            {{ allowlistSaving ? 'Saving…' : 'Save allowlist' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts">
import type {
  LlmGatewayPublic,
  LlmPolicy,
  LlmProviderKind,
  LlmProviderPublic,
  LlmTierBind,
  ModelTier,
} from '@dostigus/shared'
import {
  inferLlmProviderKind,
  LLM_PROVIDER_KIND_LABELS,
  LLM_PROVIDER_KINDS,
  MODEL_TIER_LABELS,
  MODEL_TIERS,
  OPENROUTER_DEFAULT_BASE_URL,
} from '@dostigus/shared'

type DraftProvider = LlmProviderPublic & {
  apiKey: string
  defaultModel: string
  baseUrl: string
}

definePageMeta({ layout: 'host' })

useHead({ title: 'Dostigus · Settings' })

const tiers = MODEL_TIERS
const { data, error: loadError, refresh } = await useFetch<{ llmGateway: LlmGatewayPublic }>(
  '/api/settings/llm-gateway',
)

type ClusterTimezoneSettings = {
  stored: string | null
  effective: string
  source: 'store' | 'env' | 'utc'
}

const { data: timezoneData, refresh: refreshTimezone } = await useFetch<{
  timezone: ClusterTimezoneSettings
}>('/api/settings/timezone')

const { data: allowlistData, refresh: refreshAllowlist } = await useFetch<{
  hosts: string[]
}>('/api/settings/http-allowlist')

const gateway = computed(() => data.value?.llmGateway)
const kinds = LLM_PROVIDER_KINDS
const providers = ref<DraftProvider[]>([])
const tierBinds = ref<Partial<Record<ModelTier, LlmTierBind>>>({})
const modelOverrides = ref<Partial<Record<ModelTier, string>>>({})
const addKind = ref<LlmProviderKind>('openrouter')
const addApiKey = ref('')
const addBaseUrl = ref('')
const addDefaultModel = ref('')
const saving = ref(false)
const pinging = ref(false)
const message = ref('')
const messageError = ref(false)
const hasLegacyPins = computed(() => MODEL_TIERS.some((tier) => {
  return Boolean(modelOverrides.value[tier])
}))
const timezoneInput = ref('')
const timezoneSaving = ref(false)
const timezoneMessage = ref('')
const timezoneMessageError = ref(false)
const timezone = computed(() => timezoneData.value?.timezone)
const allowlistInput = ref('')
const allowlistSaving = ref(false)
const allowlistMessage = ref('')
const allowlistMessageError = ref(false)
const allowlist = computed(() => allowlistData.value?.hosts)

const busy = computed(() => saving.value || pinging.value)
const hint = computed(() => {
  if (providers.value.length > 0) {
    return 'Map each Model tier to a Provider. You can skip this and still create Bots.'
  }
  return 'Add a Provider so Bots can reply. You can skip this and still create Bots.'
})

function kindLabel(kind: LlmProviderKind): string {
  return LLM_PROVIDER_KIND_LABELS[kind]
}

function providerKeyPlaceholder(provider: DraftProvider): string {
  if (provider.apiKeyMasked) {
    return `${provider.apiKeyMasked} — paste to replace`
  }
  return provider.kind === 'openrouter' ? 'Paste your OpenRouter key' : 'Paste your API key'
}

function providerKind(providerId: string | undefined): LlmProviderKind | null {
  if (!providerId) {
    return null
  }
  return providers.value.find((provider) => provider.id === providerId)?.kind ?? null
}

function defaultPolicyFor(tier: ModelTier, kind: LlmProviderKind, provider: DraftProvider): LlmPolicy {
  if (kind === 'openrouter') {
    return (tier === 'cheap' || tier === 'toy') ? { kind: 'free' } : { kind: 'auto' }
  }
  const modelId = provider.defaultModel.trim() || (kind === 'openai' ? 'gpt-4o' : '')
  return { kind: 'model', modelId }
}

function onProviderKind(id: string, value: string) {
  const provider = providers.value.find((entry) => entry.id === id)
  if (!provider || (value !== 'openrouter' && value !== 'openai' && value !== 'openai-compatible')) {
    return
  }
  provider.kind = value
  if (value === 'openrouter') {
    provider.baseUrl = OPENROUTER_DEFAULT_BASE_URL
  }
  for (const tier of MODEL_TIERS) {
    if (tierBinds.value[tier]?.providerId === id) {
      tierBinds.value[tier] = {
        providerId: id,
        policy: defaultPolicyFor(tier, value, provider),
      }
    }
  }
}

function onTierProvider(tier: ModelTier, providerId: string) {
  if (!providerId) {
    const next = { ...tierBinds.value }
    delete next[tier]
    tierBinds.value = next
    return
  }
  const provider = providers.value.find((entry) => entry.id === providerId)
  if (!provider) {
    return
  }
  tierBinds.value = {
    ...tierBinds.value,
    [tier]: {
      providerId,
      policy: defaultPolicyFor(tier, provider.kind, provider),
    },
  }
}

function onTierPolicy(tier: ModelTier, value: string) {
  const current = tierBinds.value[tier]
  if (!current) {
    return
  }
  if (value !== 'free' && value !== 'auto') {
    return
  }
  tierBinds.value = {
    ...tierBinds.value,
    [tier]: { ...current, policy: { kind: value } },
  }
}

function removeProvider(id: string) {
  providers.value = providers.value.filter((provider) => provider.id !== id)
  const next: Partial<Record<ModelTier, LlmTierBind>> = {}
  for (const tier of MODEL_TIERS) {
    const bind = tierBinds.value[tier]
    if (bind && bind.providerId !== id) {
      next[tier] = bind
    }
  }
  tierBinds.value = next
}

function addProvider() {
  const key = addApiKey.value.trim()
  if (!key) {
    return
  }
  const id = crypto.randomUUID()
  const kind = addKind.value
  const provider: DraftProvider = {
    id,
    kind,
    baseUrl: kind === 'openrouter'
      ? OPENROUTER_DEFAULT_BASE_URL
      : addBaseUrl.value.trim(),
    hasApiKey: true,
    apiKeyMasked: null,
    defaultModel: addDefaultModel.value.trim(),
    apiKey: key,
  }
  providers.value = [...providers.value, provider]
  addApiKey.value = ''
  addBaseUrl.value = ''
  addDefaultModel.value = ''
  if (providers.value.length === 1) {
    for (const tier of MODEL_TIERS) {
      if (tierBinds.value[tier] || modelOverrides.value[tier]) {
        continue
      }
      tierBinds.value = {
        ...tierBinds.value,
        [tier]: {
          providerId: id,
          policy: defaultPolicyFor(tier, kind, provider),
        },
      }
    }
  }
}

function applyGateway(next?: LlmGatewayPublic) {
  if (!next) {
    return
  }
  providers.value = (next.providers ?? []).map((provider) => ({
    ...provider,
    apiKey: '',
    baseUrl: provider.baseUrl
      ?? (provider.kind === 'openrouter' ? OPENROUTER_DEFAULT_BASE_URL : ''),
    defaultModel: provider.defaultModel ?? '',
  }))
  if (providers.value.length === 0 && (next.hasStoredApiKey || next.baseUrl)) {
    const kind = inferLlmProviderKind(next.baseUrl)
    providers.value = [{
      id: 'legacy',
      kind,
      baseUrl: next.baseUrl ?? (kind === 'openrouter' ? OPENROUTER_DEFAULT_BASE_URL : ''),
      hasApiKey: next.hasStoredApiKey,
      apiKeyMasked: next.apiKeyMasked,
      defaultModel: '',
      apiKey: '',
    }]
  }
  tierBinds.value = { ...(next.tierBinds ?? {}) }
  modelOverrides.value = { ...next.modelOverrides }
}

watch(gateway, (next) => applyGateway(next), { immediate: true })
watch(timezone, (next) => {
  timezoneInput.value = next?.stored ?? ''
}, { immediate: true })
watch(allowlist, (next) => {
  allowlistInput.value = next?.join('\n') ?? ''
}, { immediate: true })

function timezoneErrorText(error: unknown): string {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    const statusMessage = error.statusMessage
    if (typeof statusMessage === 'string' && statusMessage.trim()) {
      return statusMessage
    }
  }
  return 'Cluster timezone must be an IANA name.'
}

async function save() {
  saving.value = true
  message.value = ''
  messageError.value = false
  try {
    const binds: Partial<Record<ModelTier, LlmTierBind>> = { ...tierBinds.value }
    for (const tier of MODEL_TIERS) {
      const bind = binds[tier]
      const provider = providers.value.find((entry) => entry.id === bind?.providerId)
      if (!bind || !provider || provider.kind === 'openrouter') {
        continue
      }
      const modelId = provider.defaultModel.trim() || (provider.kind === 'openai' ? 'gpt-4o' : '')
      if (modelId) {
        binds[tier] = { providerId: provider.id, policy: { kind: 'model', modelId } }
      }
    }
    const result = await $fetch<{ llmGateway: LlmGatewayPublic }>('/api/settings/llm-gateway', {
      method: 'PUT',
      body: {
        providers: providers.value.map((provider) => ({
          id: provider.id,
          kind: provider.kind,
          apiKey: provider.apiKey.trim() || undefined,
          baseUrl: provider.baseUrl.trim() || null,
          defaultModel: provider.defaultModel.trim() || null,
        })),
        tierBinds: binds,
        modelOverrides: modelOverrides.value,
      },
    })
    data.value = result
    applyGateway(result.llmGateway)
    message.value = result.llmGateway.configured
      ? 'Saved.'
      : 'Saved. Add a key when you want live replies.'
  } catch {
    message.value = 'Could not save Settings.'
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

function allowlistErrorText(error: unknown): string {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    const statusMessage = error.statusMessage
    if (typeof statusMessage === 'string' && statusMessage.trim()) {
      return statusMessage
    }
  }
  return 'HTTP allowlist entries are hostnames only.'
}

function hostsFromInput(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean)
}

async function saveAllowlist() {
  allowlistSaving.value = true
  allowlistMessage.value = ''
  allowlistMessageError.value = false
  try {
    const result = await $fetch<{ hosts: string[] }>('/api/settings/http-allowlist', {
      method: 'PUT',
      body: { hosts: hostsFromInput(allowlistInput.value) },
    })
    allowlistData.value = result
    allowlistInput.value = result.hosts.join('\n')
    allowlistMessage.value = result.hosts.length === 0
      ? 'Allowlist cleared. Public hosts are allowed.'
      : 'Allowlist saved.'
  } catch (error) {
    allowlistMessage.value = allowlistErrorText(error)
    allowlistMessageError.value = true
  } finally {
    allowlistSaving.value = false
    await refreshAllowlist()
  }
}

async function saveTimezone() {
  timezoneSaving.value = true
  timezoneMessage.value = ''
  timezoneMessageError.value = false
  try {
    const result = await $fetch<{ timezone: ClusterTimezoneSettings }>('/api/settings/timezone', {
      method: 'PUT',
      body: { timezone: timezoneInput.value.trim() },
    })
    timezoneData.value = result
    timezoneInput.value = result.timezone.stored ?? ''
    timezoneMessage.value = 'Timezone saved.'
  } catch (error) {
    timezoneMessage.value = timezoneErrorText(error)
    timezoneMessageError.value = true
  } finally {
    timezoneSaving.value = false
    await refreshTimezone()
  }
}

async function ping() {
  pinging.value = true
  message.value = ''
  messageError.value = false
  try {
    const result = await $fetch<{ ok: boolean, error?: string }>(
      '/api/settings/llm-gateway/ping',
      {
        method: 'POST',
        body: { providerId: providers.value[0]?.id === 'legacy' ? undefined : providers.value[0]?.id },
      },
    )
    if (result.ok) {
      message.value = 'Connection works.'
      return
    }
    message.value = result.error ?? 'Could not reach the provider.'
    messageError.value = true
  } catch {
    message.value = 'Could not reach the provider.'
    messageError.value = true
  } finally {
    pinging.value = false
    await refresh()
  }
}
</script>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.top {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  padding: 1.15rem 1.4rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.mark {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sub {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 1.6rem 1.4rem 3rem;
}

.banner {
  margin: 0 0 1rem;
  color: var(--accent);
}

.card {
  max-width: 32rem;
  margin: 0 auto;
  padding: 1.5rem 1.45rem 1.5rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--card);
}

.card.tz {
  margin-top: 1.25rem;
}

.provider-list,
.tiers {
  margin: 0 0 1.1rem;
}

.provider {
  margin: 0 0 0.9rem;
  padding: 0.75rem 0.95rem 0.15rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}

.tiny {
  margin-left: auto;
  padding: 0.3rem 0.7rem;
  font-size: 0.78rem;
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
  border-radius: var(--radius);
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
  font-size: 0.9rem;
  line-height: 1.5;
}

.note,
.hint {
  margin: 0 0 1.1rem;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0 0 1.1rem;
}

.preset {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text-muted);
  border-radius: var(--radius);
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.preset.on {
  border-color: transparent;
  background: color-mix(in srgb, var(--accent) 22%, var(--surface));
  color: var(--accent-ink);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

input,
select,
textarea {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.9rem;
}

textarea {
  resize: vertical;
  min-height: 6.5rem;
  font-family: inherit;
}

input:focus,
select:focus,
textarea:focus {
  outline: 1px solid var(--accent-dim);
}

.advanced {
  margin: 0.2rem 0 1.1rem;
  padding: 0.75rem 0.95rem 0.15rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}

summary {
  cursor: pointer;
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-bottom: 0.7rem;
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
  border-radius: var(--radius);
  padding: 0.55rem 1rem;
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
  font-weight: 600;
}

.ghost:disabled,
.solid:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
