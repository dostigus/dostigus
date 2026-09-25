<template>
  <div class="providers">
    <header class="head">
      <p class="kicker">
        {{ $t('settings.providers.kicker') }}
      </p>
      <h1>{{ $t('settings.providers.title') }}</h1>
      <p class="lead">
        {{ $t('settings.providers.lead') }}
      </p>
    </header>

    <p
      v-if="loadError"
      class="banner error"
      role="alert"
    >
      {{ $t('settings.providers.loadError') }}
    </p>
    <p
      v-if="gateway?.envOverride"
      class="banner"
    >
      {{ $t('settings.providers.envOverride') }}
    </p>

    <div
      class="grid"
      :class="{ 'story-first': providers.length === 0 }"
    >
      <SettingsLlmFlow
        class="col-flow"
        :bots="bots"
        :providers="providers"
        :tier-binds="effectiveBinds"
        :names="names"
        :rejected="rejectedIds"
      />

      <div class="col-config">
        <SettingsProviderHealth :health="health">
          <KitButton
            v-if="providers.some((provider) => provider.hasApiKey)"
            variant="ghost"
            size="sm"
            :disabled="checking"
            @click="checkAll"
          >
            {{ checking ? $t('settings.providers.checking') : $t('settings.providers.check') }}
          </KitButton>
        </SettingsProviderHealth>

        <p
          v-if="flash"
          class="flash"
          :class="{ error: flash.error }"
          role="status"
        >
          {{ flash.text }}
        </p>

        <SettingsProviderAdd
          v-if="providers.length === 0"
          ref="firstAdd"
          first
          :busy="busy"
          @add="addProvider"
        />

        <article
          v-for="provider in providers"
          :key="provider.id"
          class="provider"
        >
          <header class="p-head">
            <span
              class="p-mark"
              :class="provider.kind"
              aria-hidden="true"
            >{{ KIND_MARKS[provider.kind] }}</span>
            <div class="p-copy">
              <h2 class="p-name">
                {{ LLM_PROVIDER_KIND_LABELS[provider.kind] }}
              </h2>
              <p class="p-meta">
                <span>{{ provider.hasApiKey
                  ? $t('settings.providers.keyWithMask', { mask: provider.apiKeyMasked ?? $t('settings.providers.keySavedShort') })
                  : $t('settings.providers.noKey') }}</span>
                <span v-if="provider.kind === 'openrouter' && routingSummary(provider.id)">· {{ routingSummary(provider.id) }}</span>
                <span v-else-if="provider.baseUrl && provider.kind === 'openai-compatible'">· {{ provider.baseUrl }}</span>
              </p>
            </div>
            <div class="p-actions">
              <KitButton
                variant="ghost"
                size="sm"
                :disabled="busy"
                @click="startEdit(provider)"
              >
                {{ provider.kind === 'openrouter' ? $t('settings.providers.replaceKey') : $t('settings.providers.edit') }}
              </KitButton>
              <button
                type="button"
                class="danger-link"
                :disabled="busy"
                @click="removeId = provider.id"
              >
                {{ $t('settings.providers.delete') }}
              </button>
            </div>
          </header>

          <div
            v-if="removeId === provider.id"
            class="confirm"
            role="alertdialog"
            :aria-label="$t('settings.providers.deleteAria', { name: LLM_PROVIDER_KIND_LABELS[provider.kind] })"
          >
            <p>
              {{ providers.length > 1
                ? $t('settings.providers.confirmEmptyTiers')
                : $t('settings.providers.confirmLast') }}
            </p>
            <div class="row-actions">
              <KitButton
                variant="ghost"
                size="sm"
                @click="removeId = ''"
              >
                {{ $t('common.cancel') }}
              </KitButton>
              <button
                type="button"
                class="danger"
                :disabled="busy"
                @click="removeProvider(provider.id)"
              >
                {{ $t('settings.providers.deleteProvider') }}
              </button>
            </div>
          </div>

          <form
            v-if="editId === provider.id"
            class="edit"
            @submit.prevent="saveEdit(provider)"
          >
            <label
              v-if="provider.kind === 'openai-compatible'"
              class="field"
            >
              <span>{{ $t('settings.providers.add.baseUrl') }}</span>
              <input
                v-model="editBaseUrl"
                type="url"
                placeholder="https://api.example.com/v1"
                autocomplete="off"
                required
              >
            </label>
            <label class="field">
              <span>{{ provider.kind === 'openrouter' ? $t('settings.providers.newOpenRouterKey') : $t('settings.providers.add.apiKey') }}</span>
              <input
                v-model="editKey"
                type="password"
                :placeholder="provider.apiKeyMasked ? $t('settings.providers.pasteNew', { mask: provider.apiKeyMasked }) : 'sk-…'"
                autocomplete="new-password"
                spellcheck="false"
                :required="provider.kind === 'openrouter'"
              >
            </label>
            <label
              v-if="provider.kind !== 'openrouter'"
              class="field"
            >
              <span>{{ $t('settings.providers.model') }}</span>
              <input
                v-model="editModel"
                type="text"
                :placeholder="provider.kind === 'openai' ? OPENAI_SETTINGS_DEFAULT_MODEL : 'Model id'"
                autocomplete="off"
                spellcheck="false"
              >
            </label>
            <div class="row-actions">
              <KitButton
                variant="ghost"
                size="sm"
                @click="editId = ''"
              >
                {{ $t('common.cancel') }}
              </KitButton>
              <KitButton
                type="submit"
                size="sm"
                :disabled="busy || (provider.kind === 'openrouter' && !editKey.trim())"
              >
                {{ busy ? $t('common.saving') : $t('common.save') }}
              </KitButton>
            </div>
          </form>

          <template v-if="provider.kind === 'openrouter' && provider.hasApiKey">
            <SettingsOpenRouterShelf
              :provider-id="provider.id"
              :catalog="catalogs[provider.id] ?? null"
              :loading="loadingIds.includes(provider.id)"
              :busy="busy"
              :tier-binds="effectiveBinds"
              :names="names"
              @pin="(slot, modelId) => pinShelf(provider.id, slot, modelId)"
              @meta="restoreMeta(provider.id)"
              @refresh="loadCatalog(provider.id, true)"
            />
            <details
              class="more"
              :open="advancedOpen[provider.id]"
              @toggle="onAdvancedToggle(provider.id, $event)"
            >
              <summary>
                <span>{{ $t('settings.providers.details') }}</span>
                <span class="summary-hint">{{ $t('settings.providers.detailsSummaryHint') }}</span>
              </summary>
              <SettingsModelCatalog
                :provider-id="provider.id"
                :providers="providers"
                :catalog="catalogs[provider.id] ?? null"
                :loading="loadingIds.includes(provider.id)"
                :busy="busy"
                :tier-binds="effectiveBinds"
                :names="names"
                @pin="(tier, modelId) => pinTier(provider.id, tier, modelId)"
                @refresh="loadCatalog(provider.id, true)"
              />
            </details>
          </template>
          <p
            v-else-if="provider.kind !== 'openrouter'"
            class="p-model"
          >
            {{ $t('settings.providers.model') }} <code>{{ provider.defaultModel || (provider.kind === 'openai' ? OPENAI_SETTINGS_DEFAULT_MODEL : $t('settings.providers.modelUnset')) }}</code>
            {{ providers.length === 1 ? $t('settings.providers.modelOnAllTiers') : $t('settings.providers.modelOnThisProvider') }}
            {{ $t('settings.providers.catalogOpenRouterOnly') }}
          </p>
        </article>

        <SettingsProviderAdd
          v-if="providers.length > 0 && adding"
          ref="nextAdd"
          :first="false"
          :busy="busy"
          @add="addProvider"
          @cancel="adding = false"
        />
        <button
          v-else-if="providers.length > 0"
          type="button"
          class="add-another"
          @click="adding = true"
        >
          <span aria-hidden="true">+</span> {{ $t('settings.providers.addProvider') }}
        </button>

        <details
          v-if="providers.length > 1 || hasLegacyPins"
          class="more page-more"
        >
          <summary>
            <span>{{ $t('settings.providers.tiersByProvider') }}</span>
            <span class="summary-hint">{{ $t('settings.providers.tiersByProviderHint') }}</span>
          </summary>
          <div
            v-if="providers.length > 1"
            class="bind-grid"
          >
            <div
              v-for="row in TIER_SITUATIONS"
              :key="row.tier"
              class="bind-row"
            >
              <div class="bind-copy">
                <p class="bind-title">
                  {{ row.title }} <code>{{ row.tier }}</code>
                </p>
                <p class="bind-detail">
                  {{ row.detail }}
                </p>
              </div>
              <select
                :aria-label="$t('settings.providers.providerFor', { tier: row.tier })"
                :value="effectiveBinds[row.tier]?.providerId ?? ''"
                :disabled="busy"
                @change="onTierProvider(row.tier, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">
                  {{ $t('settings.providers.unset') }}
                </option>
                <option
                  v-for="provider in providers"
                  :key="provider.id"
                  :value="provider.id"
                >
                  {{ providerOptionLabel(provider) }}
                </option>
              </select>
              <select
                v-if="providerKind(effectiveBinds[row.tier]?.providerId) === 'openrouter'"
                :aria-label="$t('settings.providers.policyFor', { tier: row.tier })"
                :value="effectiveBinds[row.tier]?.policy.kind ?? 'auto'"
                :disabled="busy"
                @change="onTierPolicy(row.tier, ($event.target as HTMLSelectElement).value)"
              >
                <option value="free">
                  Free
                </option>
                <option value="auto">
                  Auto
                </option>
                <option
                  v-if="effectiveBinds[row.tier]?.policy.kind === 'model'"
                  value="model"
                >
                  {{ pinnedName(row.tier) }}
                </option>
              </select>
            </div>
          </div>

          <form
            v-if="hasLegacyPins"
            class="legacy"
            @submit.prevent="saveLegacyPins"
          >
            <p class="bind-title">
              {{ $t('settings.providers.catalog.legacyIds') }}
            </p>
            <p class="bind-detail">
              {{ $t('settings.providers.legacyPinsHint') }}
            </p>
            <label
              v-for="tier in MODEL_TIERS"
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
            <div class="row-actions">
              <KitButton
                type="submit"
                size="sm"
                :disabled="busy"
              >
                {{ $t('common.save') }}
              </KitButton>
            </div>
          </form>
        </details>
      </div>
    </div>
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
  OpenRouterCatalogPublic,
  OpenRouterShelfSlot,
} from '@dostigus/shared'
import {
  clearOpenRouterPins,
  defaultBaseUrlForKind,
  inferLlmProviderKind,
  LEGACY_LLM_PROVIDER_ID,
  LLM_PROVIDER_KIND_LABELS,
  MODEL_TIER_LABELS,
  MODEL_TIERS,
  OPENAI_SETTINGS_DEFAULT_MODEL,
  openRouterMetaPolicy,
  openRouterRoutingMode,
  pinOpenRouterShelf,
  pinOpenRouterTiers,
} from '@dostigus/shared'
import { KitButton } from '@dostigus/ui-kit'
import { providerHealth, tierSituations } from '../../utils/provider-settings'

type Binds = Partial<Record<ModelTier, LlmTierBind>>

const KIND_MARKS: Record<LlmProviderKind, string> = {
  'openrouter': 'OR',
  'openai': 'AI',
  'openai-compatible': '{ }',
}

const { locale, t } = useI18n()
const hostLocale = computed(() => locale.value === 'ru' ? 'ru' as const : 'en' as const)
const TIER_SITUATIONS = computed(() => tierSituations(hostLocale.value))

const { data, error: loadError } = await useFetch<{ llmGateway: LlmGatewayPublic }>(
  '/api/settings/llm-gateway',
)
const { bots } = await useHostBots()

const gateway = computed(() => data.value?.llmGateway)

/** A Store saved before Providers has one legacy row. Show it as one Provider. */
const providers = computed<LlmProviderPublic[]>(() => {
  const next = gateway.value
  if (!next) {
    return []
  }
  if (next.providers.length > 0) {
    return next.providers
  }
  if (next.hasStoredApiKey) {
    return [{
      id: LEGACY_LLM_PROVIDER_ID,
      kind: inferLlmProviderKind(next.baseUrl),
      baseUrl: next.baseUrl,
      hasApiKey: true,
      apiKeyMasked: next.apiKeyMasked,
      defaultModel: null,
    }]
  }
  return []
})

const legacyOnly = computed(() => (gateway.value?.providers.length ?? 0) === 0 && providers.value.length > 0)

/** Legacy rows resolve each tier as a pinned model id until Settings saves a bind. */
const effectiveBinds = computed<Binds>(() => {
  const next = gateway.value
  if (!next) {
    return {}
  }
  if (!legacyOnly.value) {
    return next.tierBinds ?? {}
  }
  const out: Binds = {}
  for (const tier of MODEL_TIERS) {
    out[tier] = {
      providerId: LEGACY_LLM_PROVIDER_ID,
      policy: { kind: 'model', modelId: next.modelOverrides[tier] ?? next.defaultModels[tier] },
    }
  }
  return out
})

const modelOverrides = ref<Partial<Record<ModelTier, string>>>({})
const hasLegacyPins = computed(() => MODEL_TIERS.some((tier) => Boolean(gateway.value?.modelOverrides[tier])))
watch(gateway, (next) => {
  modelOverrides.value = { ...next?.modelOverrides }
}, { immediate: true })

const busy = ref(false)
const checking = ref(false)
const flash = ref<{ text: string, error: boolean } | null>(null)
const adding = ref(false)
const editId = ref('')
const editKey = ref('')
const editBaseUrl = ref('')
const editModel = ref('')
const removeId = ref('')
const advancedOpen = ref<Record<string, boolean>>({})
const firstAdd = ref<{ reset: () => void } | null>(null)
const nextAdd = ref<{ reset: () => void } | null>(null)

const catalogs = ref<Record<string, OpenRouterCatalogPublic>>({})
const loadingIds = ref<string[]>([])
const pings = ref<Record<string, boolean>>({})

const names = computed(() => {
  const out: Record<string, string> = {}
  for (const catalog of Object.values(catalogs.value)) {
    for (const model of catalog.models) {
      out[model.id] = model.name
    }
  }
  return out
})

const rejectedIds = computed(() => Object.values(catalogs.value)
  .filter((catalog) => catalog.keyAccepted === false)
  .map((catalog) => catalog.providerId))

const health = computed(() => providerHealth({
  providers: providers.value,
  tierBinds: effectiveBinds.value,
  catalogs: catalogs.value,
  loading: new Set(loadingIds.value),
  pings: pings.value,
  locale: hostLocale.value,
}))

function say(text: string, error = false) {
  flash.value = { text, error }
}

function errorText(error: unknown, fallback: string): string {
  const fetchError = error as { data?: { statusMessage?: string }, statusMessage?: string }
  return fetchError.data?.statusMessage ?? fetchError.statusMessage ?? fallback
}

function providerKind(id: string | undefined): LlmProviderKind | null {
  return providers.value.find((provider) => provider.id === id)?.kind ?? null
}

function providerOptionLabel(provider: LlmProviderPublic): string {
  const label = LLM_PROVIDER_KIND_LABELS[provider.kind]
  return provider.apiKeyMasked ? `${label} · ${provider.apiKeyMasked}` : label
}

/** Only the unusual case. The routing card already says meta vs pinned. */
function routingSummary(providerId: string): string {
  return openRouterRoutingMode(effectiveBinds.value, providerId) === 'none'
    ? t('settings.providers.notBound')
    : ''
}

function pinnedName(tier: ModelTier): string {
  const policy = effectiveBinds.value[tier]?.policy
  if (policy?.kind !== 'model') {
    return ''
  }
  return names.value[policy.modelId] ?? policy.modelId
}

function providerWrite(provider: LlmProviderPublic) {
  return {
    id: provider.id,
    kind: provider.kind,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel,
  }
}

async function put(body: Record<string, unknown>): Promise<LlmGatewayPublic> {
  const result = await $fetch<{ llmGateway: LlmGatewayPublic }>('/api/settings/llm-gateway', {
    method: 'PUT',
    body,
  })
  data.value = result
  return result.llmGateway
}

async function writeBinds(binds: Binds, success: string) {
  busy.value = true
  try {
    const body: Record<string, unknown> = { tierBinds: binds }
    if (legacyOnly.value) {
      body.providers = providers.value.map(providerWrite)
    }
    await put(body)
    say(success)
  } catch (error) {
    say(errorText(error, t('settings.providers.saveFailed')), true)
  } finally {
    busy.value = false
  }
}

const catalogFlights = new Map<string, Promise<void>>()

function loadCatalog(providerId: string, refresh = false): Promise<void> {
  const flying = catalogFlights.get(providerId)
  if (flying) {
    return flying
  }
  const flight = fetchCatalog(providerId, refresh).finally(() => {
    catalogFlights.delete(providerId)
  })
  catalogFlights.set(providerId, flight)
  return flight
}

async function fetchCatalog(providerId: string, refresh: boolean) {
  loadingIds.value = [...loadingIds.value, providerId]
  try {
    const result = await $fetch<{ catalog: OpenRouterCatalogPublic }>(
      `/api/settings/llm-gateway/providers/${encodeURIComponent(providerId)}/catalog`,
      { query: refresh ? { refresh: '1' } : undefined },
    )
    catalogs.value = { ...catalogs.value, [providerId]: result.catalog }
  } catch {
    catalogs.value = {
      ...catalogs.value,
      [providerId]: {
        providerId,
        ok: false,
        error: 'network',
        keyAccepted: null,
        fetchedAt: null,
        stale: false,
        models: [],
        shelf: { free: [], smart: [], coding: [] },
        ranking: 'benchmarks',
      },
    }
  } finally {
    loadingIds.value = loadingIds.value.filter((id) => id !== providerId)
  }
}

async function ping(providerId: string) {
  try {
    const result = await $fetch<{ ok: boolean }>('/api/settings/llm-gateway/ping', {
      method: 'POST',
      body: { providerId: providerId === LEGACY_LLM_PROVIDER_ID ? undefined : providerId },
    })
    pings.value = { ...pings.value, [providerId]: result.ok }
  } catch {
    pings.value = { ...pings.value, [providerId]: false }
  }
}

async function checkAll() {
  checking.value = true
  flash.value = null
  try {
    await Promise.all(providers.value
      .filter((provider) => provider.hasApiKey)
      .map((provider) => provider.kind === 'openrouter'
        ? loadCatalog(provider.id, true)
        : ping(provider.id)))
  } finally {
    checking.value = false
  }
}

async function addProvider(input: { kind: LlmProviderKind, apiKey: string, baseUrl: string, defaultModel: string }) {
  busy.value = true
  flash.value = null
  const id = crypto.randomUUID()
  try {
    const saved = await put({
      providers: [
        ...providers.value.map(providerWrite),
        {
          id,
          kind: input.kind,
          apiKey: input.apiKey,
          baseUrl: defaultBaseUrlForKind(input.kind, input.baseUrl),
          defaultModel: input.kind === 'openrouter' ? null : (input.defaultModel || null),
        },
      ],
    })
    firstAdd.value?.reset()
    nextAdd.value?.reset()
    adding.value = false
    const sole = saved.providers.length === 1
    if (input.kind !== 'openrouter') {
      say(sole
        ? t('settings.providers.flashKeySavedCheck')
        : t('settings.providers.flashProviderAdded'))
      return
    }
    say(t('settings.providers.flashKeySavedChecking'))
    await loadCatalog(id)
    const accepted = catalogs.value[id]?.keyAccepted
    if (accepted === false) {
      flash.value = null
    } else if (sole) {
      say(t('settings.providers.flashKeySavedReady'))
    } else {
      say(t('settings.providers.flashProviderAdded'))
    }
  } catch (error) {
    say(errorText(error, t('settings.providers.saveFailed')), true)
  } finally {
    busy.value = false
  }
}

function startEdit(provider: LlmProviderPublic) {
  removeId.value = ''
  editId.value = editId.value === provider.id ? '' : provider.id
  editKey.value = ''
  editBaseUrl.value = provider.baseUrl ?? ''
  editModel.value = provider.defaultModel ?? ''
}

async function saveEdit(provider: LlmProviderPublic) {
  busy.value = true
  flash.value = null
  const key = editKey.value.trim()
  try {
    await put({
      providers: providers.value.map((entry) => {
        if (entry.id !== provider.id) {
          return providerWrite(entry)
        }
        return {
          ...providerWrite(entry),
          apiKey: key || undefined,
          baseUrl: entry.kind === 'openai-compatible' ? editBaseUrl.value.trim() : entry.baseUrl,
          defaultModel: entry.kind === 'openrouter' ? entry.defaultModel : (editModel.value.trim() || null),
        }
      }),
    })
    editId.value = ''
    editKey.value = ''
    say(key ? t('settings.providers.flashKeyReplaced') : t('settings.providers.flashSaved'))
    if (provider.kind === 'openrouter' && key) {
      void loadCatalog(provider.id, true)
    } else if (provider.kind !== 'openrouter') {
      const next = { ...pings.value }
      delete next[provider.id]
      pings.value = next
    }
  } catch (error) {
    say(errorText(error, t('settings.providers.saveFailed')), true)
  } finally {
    busy.value = false
  }
}

async function removeProvider(id: string) {
  busy.value = true
  flash.value = null
  try {
    const rest = providers.value.filter((provider) => provider.id !== id)
    const binds: Binds = {}
    for (const tier of MODEL_TIERS) {
      const bind = effectiveBinds.value[tier]
      if (bind && bind.providerId !== id) {
        binds[tier] = bind
      }
    }
    await put({
      providers: rest.map(providerWrite),
      tierBinds: binds,
      ...(rest.length === 0 ? { clearApiKey: true } : {}),
    })
    const next = { ...catalogs.value }
    delete next[id]
    catalogs.value = next
    removeId.value = ''
    say(t('settings.providers.flash.providerRemoved'))
  } catch (error) {
    say(errorText(error, t('settings.providers.saveFailed')), true)
  } finally {
    busy.value = false
  }
}

function pinShelf(providerId: string, slot: OpenRouterShelfSlot, modelId: string) {
  const name = names.value[modelId] ?? modelId
  void writeBinds(
    pinOpenRouterShelf(effectiveBinds.value, providerId, slot, modelId),
    `${name} ${t('settings.providers.flash.pinned')}`,
  )
}

function pinTier(providerId: string, tier: ModelTier, modelId: string | null) {
  const name = modelId ? (names.value[modelId] ?? modelId) : ''
  void writeBinds(
    pinOpenRouterTiers(effectiveBinds.value, providerId, [tier], modelId),
    modelId ? t('settings.providers.flashPinnedOn', { name, tier }) : t('settings.providers.flashRoutingAgain', { tier }),
  )
}

function restoreMeta(providerId: string) {
  const mode = openRouterRoutingMode(effectiveBinds.value, providerId)
  void writeBinds(
    clearOpenRouterPins(effectiveBinds.value, providerId, {
      fillEmpty: providers.value.length === 1 || mode === 'none',
    }),
    t('settings.providers.flashRoutingRestored'),
  )
}

function defaultPolicyFor(tier: ModelTier, provider: LlmProviderPublic): LlmPolicy {
  if (provider.kind === 'openrouter') {
    return openRouterMetaPolicy(tier)
  }
  const modelId = provider.defaultModel?.trim()
    || (provider.kind === 'openai' ? OPENAI_SETTINGS_DEFAULT_MODEL : '')
  return { kind: 'model', modelId }
}

function onTierProvider(tier: ModelTier, providerId: string) {
  const next: Binds = { ...effectiveBinds.value }
  const provider = providers.value.find((entry) => entry.id === providerId)
  if (!provider) {
    delete next[tier]
  } else {
    next[tier] = { providerId, policy: defaultPolicyFor(tier, provider) }
  }
  void writeBinds(next, t('settings.providers.flash.tiersSaved'))
}

function onTierPolicy(tier: ModelTier, value: string) {
  const current = effectiveBinds.value[tier]
  if (!current || (value !== 'free' && value !== 'auto')) {
    return
  }
  void writeBinds({ ...effectiveBinds.value, [tier]: { ...current, policy: { kind: value } } }, t('settings.providers.flash.tiersSaved'))
}

async function saveLegacyPins() {
  busy.value = true
  try {
    await put({ modelOverrides: modelOverrides.value })
    say(t('settings.providers.flashSaved'))
  } catch (error) {
    say(errorText(error, t('settings.providers.saveFailed')), true)
  } finally {
    busy.value = false
  }
}

function onAdvancedToggle(providerId: string, event: Event) {
  advancedOpen.value = {
    ...advancedOpen.value,
    [providerId]: (event.target as HTMLDetailsElement).open,
  }
}

const openRouterIds = computed(() => providers.value
  .filter((provider) => provider.kind === 'openrouter' && provider.hasApiKey)
  .map((provider) => provider.id))

onMounted(() => {
  watch(openRouterIds, (ids) => {
    for (const id of ids) {
      if (!catalogs.value[id]) {
        void loadCatalog(id)
      }
    }
  }, { immediate: true })
})
</script>

<style scoped>
.providers {
  container-type: inline-size;
  max-width: 76rem;
}

.head {
  max-width: 44rem;
  margin-bottom: 1.4rem;
}

.kicker {
  margin: 0 0 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent);
}

h1 {
  margin: 0 0 0.45rem;
  font-size: 1.7rem;
  line-height: 1.2;
}

.lead {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.55;
}

.banner {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 0.9rem;
}

.banner.error {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.col-flow {
  order: 2;
  min-width: 0;
}

.col-config {
  order: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.story-first .col-flow {
  order: 0;
}

@container (min-width: 54rem) {
  .grid {
    grid-template-columns: minmax(15.5rem, 19rem) minmax(0, 1fr);
    gap: 1.4rem;
  }

  .col-flow {
    order: 0;
    position: sticky;
    top: 0;
  }

  .col-config {
    order: 0;
  }
}

.flash {
  margin: 0;
  padding: 0.55rem 0.9rem;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--live) 10%, var(--card));
  font-size: 0.88rem;
}

.flash.error {
  background: color-mix(in srgb, var(--accent) 10%, var(--card));
  color: var(--accent);
}

.provider {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.15rem 1.2rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--card);
}

.p-head {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.p-mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 0.85rem;
  background: var(--surface);
  font-weight: 800;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
}

.p-mark.openrouter {
  background: color-mix(in srgb, var(--bot-accent-10) 30%, var(--surface));
}

.p-mark.openai {
  background: color-mix(in srgb, var(--bot-accent-07) 30%, var(--surface));
}

.p-copy {
  flex: 1;
  min-width: 0;
}

.p-name {
  margin: 0;
  font-size: 1.05rem;
}

.p-meta {
  margin: 0.1rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.p-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.p-model {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.86rem;
  line-height: 1.55;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.74rem;
  padding: 0.05rem 0.4rem;
  border-radius: 0.4rem;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  color: var(--text-muted);
}

.danger-link {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.danger-link:hover:not(:disabled) {
  color: var(--accent);
}

.confirm,
.edit {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--line);
  border-radius: 1.1rem;
  background: var(--bg);
}

.confirm {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
}

.confirm p {
  margin: 0;
  font-size: 0.9rem;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.danger {
  appearance: none;
  border: 1px solid var(--accent-dim);
  background: transparent;
  color: var(--accent);
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  font: inherit;
  font-size: 0.92rem;
  cursor: pointer;
}

.danger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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
  padding: 0.65rem 0.9rem;
}

input:focus,
select:focus {
  outline: 1px solid var(--accent-dim);
}

.more {
  border-top: 1px solid var(--line-soft);
  padding-top: 0.8rem;
}

.page-more {
  padding: 0.9rem 1.2rem 1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--card);
}

summary {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  cursor: pointer;
  font-weight: 700;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

summary::before {
  content: '';
  align-self: center;
  width: 0.45rem;
  height: 0.45rem;
  border-right: 2px solid var(--text-muted);
  border-bottom: 2px solid var(--text-muted);
  transform: rotate(-45deg);
  transition: transform 140ms ease;
}

details[open] > summary::before {
  transform: rotate(45deg);
}

details[open] > summary {
  margin-bottom: 0.6rem;
}

.summary-hint {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 0.8rem;
}

.add-another {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.85rem;
  border: 1px dashed var(--line);
  border-radius: var(--radius-card);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  cursor: pointer;
}

.add-another:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--text) 30%, var(--line));
}

.bind-grid {
  display: flex;
  flex-direction: column;
}

.bind-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 0;
}

.bind-row + .bind-row {
  border-top: 1px solid var(--line-soft);
}

.bind-copy {
  flex: 1 1 14rem;
  min-width: 0;
}

.bind-title {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-weight: 700;
  font-size: 0.9rem;
}

.bind-detail {
  margin: 0.1rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.bind-row select {
  padding: 0.45rem 0.8rem;
  font-size: 0.85rem;
}

.legacy {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-top: 1rem;
}

@media (max-width: 30rem) {
  .p-head {
    flex-wrap: wrap;
  }

  .p-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
