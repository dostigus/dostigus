<template>
  <div class="providers">
    <header class="head">
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
          :error="addError"
          @add="addProvider"
        />

        <KitPanel
          v-for="provider in providers"
          :key="provider.id"
          as="article"
          class="provider"
        >
          <header class="p-head">
            <span
              class="p-mark"
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
              <KitButton
                variant="ghost"
                size="sm"
                :disabled="busy"
                @click="removeId = provider.id"
              >
                {{ $t('settings.providers.delete') }}
              </KitButton>
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
              <KitButton
                size="sm"
                :disabled="busy"
                @click="removeProvider(provider.id)"
              >
                {{ $t('settings.providers.deleteProvider') }}
              </KitButton>
            </div>
          </div>

          <form
            v-if="editId === provider.id"
            class="edit"
            @submit.prevent="saveEdit(provider)"
          >
            <KitField
              v-if="provider.kind === 'openai-compatible'"
              :label="$t('settings.providers.add.baseUrl')"
              :error="editErrorOn('baseUrl', provider)"
              required
            >
              <KitInput
                v-model="editBaseUrl"
                type="url"
                placeholder="https://api.example.com/v1"
                autocomplete="off"
              />
            </KitField>
            <KitField
              :label="provider.kind === 'openrouter' ? $t('settings.providers.newOpenRouterKey') : $t('settings.providers.add.apiKey')"
              :error="editErrorOn('apiKey', provider)"
              :required="provider.kind === 'openrouter'"
            >
              <KitInput
                v-model="editKey"
                type="password"
                :placeholder="provider.apiKeyMasked ? $t('settings.providers.pasteNew', { mask: provider.apiKeyMasked }) : 'sk-…'"
                autocomplete="new-password"
                spellcheck="false"
              />
            </KitField>
            <KitField
              v-if="provider.kind !== 'openrouter'"
              :label="$t('settings.providers.model')"
              :error="editErrorOn('model', provider)"
            >
              <KitInput
                v-model="editModel"
                :placeholder="provider.kind === 'openai' ? OPENAI_SETTINGS_DEFAULT_MODEL : $t('settings.providers.add.modelId')"
                autocomplete="off"
                spellcheck="false"
              />
            </KitField>
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
            <div class="more">
              <KitListRow
                as="button"
                class="disclosure"
                :title="$t('settings.providers.details')"
                :subtitle="$t('settings.providers.detailsSummaryHint')"
                :aria-expanded="Boolean(advancedOpen[provider.id])"
                :aria-controls="`${uid}-details-${provider.id}`"
                @click="toggleAdvanced(provider.id)"
              >
                <template #trailing>
                  <span
                    class="chevron"
                    aria-hidden="true"
                  >›</span>
                </template>
              </KitListRow>
              <SettingsModelCatalog
                v-show="advancedOpen[provider.id]"
                :id="`${uid}-details-${provider.id}`"
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
            </div>
          </template>
          <p
            v-else-if="provider.kind !== 'openrouter'"
            class="p-model"
          >
            {{ $t('settings.providers.model') }} <code>{{ provider.defaultModel || (provider.kind === 'openai' ? OPENAI_SETTINGS_DEFAULT_MODEL : $t('settings.providers.modelUnset')) }}</code>
            {{ providers.length === 1 ? $t('settings.providers.modelOnAllTiers') : $t('settings.providers.modelOnThisProvider') }}
            {{ $t('settings.providers.catalogOpenRouterOnly') }}
          </p>
        </KitPanel>

        <SettingsProviderAdd
          v-if="providers.length > 0 && adding"
          ref="nextAdd"
          :first="false"
          :busy="busy"
          :error="addError"
          @add="addProvider"
          @cancel="cancelAdd"
        />
        <KitButton
          v-else-if="providers.length > 0"
          variant="ghost"
          class="add-another"
          @click="adding = true"
        >
          <span aria-hidden="true">+</span>&nbsp;{{ $t('settings.providers.addProvider') }}
        </KitButton>

        <KitPanel
          v-if="providers.length > 1 || hasLegacyPins"
          as="div"
          class="page-more"
        >
          <KitListRow
            as="button"
            class="disclosure"
            :title="$t('settings.providers.tiersByProvider')"
            :subtitle="$t('settings.providers.tiersByProviderHint')"
            :aria-expanded="tiersOpen"
            :aria-controls="`${uid}-tiers`"
            @click="tiersOpen = !tiersOpen"
          >
            <template #trailing>
              <span
                class="chevron"
                aria-hidden="true"
              >›</span>
            </template>
          </KitListRow>
          <div
            v-show="tiersOpen"
            :id="`${uid}-tiers`"
            class="tiers"
          >
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
                <div class="bind-select">
                  <label
                    class="kit-sr-only"
                    :for="`${uid}-provider-${row.tier}`"
                  >{{ $t('settings.providers.providerFor', { tier: row.tier }) }}</label>
                  <KitSelect
                    :id="`${uid}-provider-${row.tier}`"
                    :model-value="effectiveBinds[row.tier]?.providerId ?? UNSET"
                    :options="tierProviderOptions"
                    :disabled="busy"
                    @update:model-value="(value) => onTierProvider(row.tier, value === UNSET ? '' : value ?? '')"
                  />
                </div>
                <div
                  v-if="providerKind(effectiveBinds[row.tier]?.providerId) === 'openrouter'"
                  class="bind-select"
                >
                  <label
                    class="kit-sr-only"
                    :for="`${uid}-policy-${row.tier}`"
                  >{{ $t('settings.providers.policyFor', { tier: row.tier }) }}</label>
                  <KitSelect
                    :id="`${uid}-policy-${row.tier}`"
                    :model-value="effectiveBinds[row.tier]?.policy.kind ?? 'auto'"
                    :options="tierPolicyOptions(row.tier)"
                    :disabled="busy"
                    @update:model-value="(value) => onTierPolicy(row.tier, value ?? '')"
                  />
                </div>
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
              <KitField
                v-for="tier in MODEL_TIERS"
                :key="tier"
                :label="MODEL_TIER_LABELS[tier]"
              >
                <KitInput
                  v-model="modelOverrides[tier]"
                  :placeholder="gateway?.defaultModels[tier]"
                  autocomplete="off"
                />
              </KitField>
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
          </div>
        </KitPanel>
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
import type { KitSelectOption } from '@dostigus/ui-kit'
import type { ProviderFormField } from '../../utils/provider-settings'
import {
  clearOpenRouterPins,
  defaultBaseUrlForKind,
  LLM_PROVIDER_KIND_LABELS,
  MODEL_TIER_LABELS,
  MODEL_TIERS,
  OPENAI_SETTINGS_DEFAULT_MODEL,
  openRouterMetaPolicy,
  openRouterRoutingMode,
  pinOpenRouterShelf,
  pinOpenRouterTiers,
} from '@dostigus/shared'
import { KitButton, KitField, KitInput, KitListRow, KitPanel, KitSelect } from '@dostigus/ui-kit'
import { providerErrorField, providerHealth, tierSituations } from '../../utils/provider-settings'

type Binds = Partial<Record<ModelTier, LlmTierBind>>

/** Reka Select items cannot carry an empty value. */
const UNSET = '__unset'

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

const providers = computed<LlmProviderPublic[]>(() => gateway.value?.providers ?? [])

const effectiveBinds = computed<Binds>(() => gateway.value?.tierBinds ?? {})

const modelOverrides = ref<Partial<Record<ModelTier, string>>>({})
const hasLegacyPins = computed(() => MODEL_TIERS.some((tier) => Boolean(gateway.value?.modelOverrides[tier])))
watch(gateway, (next) => {
  modelOverrides.value = { ...next?.modelOverrides }
}, { immediate: true })

const uid = useId()
const busy = ref(false)
const checking = ref(false)
const flash = ref<{ text: string, error: boolean } | null>(null)
const adding = ref(false)
const addError = ref('')
const editId = ref('')
const editKey = ref('')
const editBaseUrl = ref('')
const editModel = ref('')
const editError = ref('')
const removeId = ref('')
const advancedOpen = ref<Record<string, boolean>>({})
const tiersOpen = ref(false)
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

const tierProviderOptions = computed<KitSelectOption[]>(() => [
  { value: UNSET, label: t('settings.providers.unset') },
  ...providers.value.map((provider) => ({ value: provider.id, label: providerOptionLabel(provider) })),
])

function tierPolicyOptions(tier: ModelTier): KitSelectOption[] {
  const options: KitSelectOption[] = [
    { value: 'free', label: 'Free' },
    { value: 'auto', label: 'Auto' },
  ]
  if (effectiveBinds.value[tier]?.policy.kind === 'model') {
    options.push({ value: 'model', label: pinnedName(tier) })
  }
  return options
}

function editErrorOn(field: ProviderFormField, provider: LlmProviderPublic): string | undefined {
  const text = editError.value
  return text && providerErrorField(text, provider.kind) === field ? text : undefined
}

function cancelAdd() {
  adding.value = false
  addError.value = ''
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
    await put({ tierBinds: binds })
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
      body: { providerId },
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
  addError.value = ''
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
    addError.value = errorText(error, t('settings.providers.saveFailed'))
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
  editError.value = ''
}

async function saveEdit(provider: LlmProviderPublic) {
  busy.value = true
  flash.value = null
  editError.value = ''
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
    editError.value = errorText(error, t('settings.providers.saveFailed'))
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

function toggleAdvanced(providerId: string) {
  advancedOpen.value = {
    ...advancedOpen.value,
    [providerId]: !advancedOpen.value[providerId],
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

h1 {
  margin: 0 0 0.35rem;
  font-size: 1.45rem;
}

.lead {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
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
  border-radius: var(--radius);
  background: var(--surface);
  font-weight: 800;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
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
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  color: var(--text-muted);
}

.confirm,
.edit {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-block: 1rem;
  border-block: 1px solid var(--line-soft);
}

.confirm {
  flex-flow: row wrap;
  align-items: center;
  justify-content: space-between;
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

.more {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border-top: 1px solid var(--line-soft);
  padding-top: 0.6rem;
}

.chevron {
  color: var(--text);
  font-size: 1.5rem;
  line-height: 1;
  transition: transform 140ms ease;
}

.disclosure[aria-expanded='true'] .chevron {
  transform: rotate(90deg);
}

.add-another {
  align-self: flex-start;
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

.bind-select {
  flex: 0 1 13rem;
  min-width: 0;
}

.legacy {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-top: 1rem;
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
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
