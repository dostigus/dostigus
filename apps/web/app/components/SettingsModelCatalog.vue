<template>
  <div class="advanced">
    <section
      class="block"
      aria-labelledby="adv-tiers"
    >
      <h4 id="adv-tiers">
        {{ $t('settings.providers.catalog.tiersTitle') }}
      </h4>
      <p class="hint">
        {{ $t('settings.providers.catalog.tiersHint') }}
      </p>
      <ul class="tier-list">
        <li
          v-for="row in tierRows"
          :key="row.tier"
        >
          <code>{{ row.tier }}</code>
          <span class="tier-title">{{ row.title }}</span>
          <span
            class="tier-policy"
            :class="{ pinned: row.pinned }"
            :title="row.policy"
          >{{ row.policy }}</span>
          <button
            v-if="row.pinned"
            type="button"
            class="link"
            :disabled="busy"
            @click="emit('pin', row.tier, null)"
          >
            {{ $t('settings.providers.catalog.reset') }}
          </button>
        </li>
      </ul>
    </section>

    <section
      class="block"
      aria-labelledby="adv-all"
    >
      <div class="block-head">
        <h4 id="adv-all">
          {{ $t('settings.providers.catalog.all') }}
          <span
            v-if="catalog?.models.length"
            class="count"
          >{{ $t('settings.providers.catalog.count', { filtered: filtered.length, total: catalog.models.length }) }}</span>
        </h4>
        <div class="refresh">
          <span
            v-if="catalog?.fetchedAt"
            class="fetched"
          >{{ fetchedAtCopy(catalog.fetchedAt, undefined, hostLocale) }}<template v-if="catalog.stale"> · {{ $t('settings.providers.catalog.fromCache') }}</template></span>
          <KitButton
            variant="ghost"
            size="sm"
            :disabled="loading"
            @click="emit('refresh')"
          >
            {{ loading ? $t('settings.providers.catalog.refreshing') : $t('settings.providers.catalog.refresh') }}
          </KitButton>
        </div>
      </div>

      <div class="toolbar">
        <label class="search">
          <span class="kit-sr-only">{{ $t('settings.providers.catalog.find') }}</span>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              cx="11"
              cy="11"
              r="6.5"
            />
            <path d="M16 16.5L20 20.5" />
          </svg>
          <input
            v-model="query"
            type="search"
            :placeholder="$t('settings.providers.catalog.find')"
            autocomplete="off"
            spellcheck="false"
          >
        </label>
        <div
          class="filters"
          role="radiogroup"
          :aria-label="$t('settings.providers.catalog.filter')"
        >
          <button
            v-for="option in FILTERS"
            :key="option.id"
            type="button"
            role="radio"
            class="chip"
            :class="{ on: filter === option.id }"
            :aria-checked="filter === option.id"
            @click="filter = option.id"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <p
        v-if="!catalog?.ok && !loading"
        class="hint"
      >
        {{ catalogErrorCopy(catalog?.error ?? 'network', hostLocale) }}
      </p>
      <p
        v-else-if="filtered.length === 0 && !loading"
        class="hint"
      >
        {{ $t('settings.providers.catalog.noneFound') }}
      </p>
      <ul
        v-else
        class="models"
      >
        <li
          v-for="model in visible"
          :key="model.id"
          class="model"
        >
          <div class="model-copy">
            <p class="model-name">
              {{ model.name }}
            </p>
            <p class="model-id">
              {{ model.id }}
            </p>
            <p class="model-meta">
              <span class="price">{{ modelPriceCopy(model, hostLocale) }}</span>
              <span v-if="model.contextLength">{{ contextCopy(model.contextLength, hostLocale) }}</span>
              <span
                v-if="model.intelligence != null"
                :title="$t('settings.providers.shelf.scoreTitleIntelligence')"
              >{{ $t('settings.providers.catalog.intelligence', { n: Math.round(model.intelligence) }) }}</span>
              <span
                v-if="model.vision"
                class="vision"
              >{{ $t('settings.providers.shelf.vision') }}</span>
              <span
                v-if="!model.tools"
                class="warn"
              >{{ $t('settings.providers.catalog.noTools') }}</span>
              <span
                v-if="model.expiresAt"
                class="warn"
              >{{ $t('settings.providers.catalog.expires', { date: model.expiresAt }) }}</span>
            </p>
            <p
              v-if="pinnedTiers(model.id).length > 0"
              class="pinned-on"
            >
              {{ $t('settings.providers.catalog.pinnedOn') }}
              <code
                v-for="tier in pinnedTiers(model.id)"
                :key="tier"
              >{{ tier }}</code>
            </p>
          </div>
          <label class="pin">
            <span class="kit-sr-only">{{ $t('settings.providers.catalog.pinSr', { name: model.name }) }}</span>
            <select
              :disabled="busy || !model.tools"
              :title="model.tools ? undefined : $t('settings.providers.catalog.noToolsHint')"
              value=""
              @change="onPin(model.id, $event)"
            >
              <option
                value=""
                disabled
              >
                {{ $t('settings.providers.catalog.pinTo') }}
              </option>
              <option
                v-for="tier in MODEL_TIERS"
                :key="tier"
                :value="tier"
              >
                {{ tier }}
              </option>
            </select>
          </label>
        </li>
      </ul>
      <KitButton
        v-if="filtered.length > visible.length"
        variant="ghost"
        size="sm"
        @click="limit += PAGE"
      >
        {{ $t('settings.providers.catalog.showMore', { n: Math.min(PAGE, filtered.length - visible.length) }) }}
      </KitButton>
    </section>

    <section
      class="block"
      aria-labelledby="adv-policy"
    >
      <h4 id="adv-policy">
        {{ $t('settings.providers.catalog.policy') }}
      </h4>
      <p class="hint">
        {{ $t('settings.providers.catalog.policyHint') }}
      </p>
      <pre class="raw">{{ rawPolicy }}</pre>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { LlmProviderKind, LlmTierBind, ModelTier, OpenRouterCatalogPublic } from '@dostigus/shared'
import { MODEL_TIERS } from '@dostigus/shared'
import { KitButton } from '@dostigus/ui-kit'
import {
  bindCopy,
  catalogErrorCopy,
  contextCopy,
  fetchedAtCopy,
  modelPriceCopy,
  searchCatalogModels,
  tierSituations,
} from '../utils/provider-settings'

const props = defineProps<{
  providerId: string
  providers: Array<{ id: string, kind: LlmProviderKind }>
  catalog: OpenRouterCatalogPublic | null
  loading: boolean
  busy: boolean
  tierBinds: Partial<Record<ModelTier, LlmTierBind>>
  names: Record<string, string>
}>()

const emit = defineEmits<{
  pin: [tier: ModelTier, modelId: string | null]
  refresh: []
}>()

const PAGE = 40
const { locale, t } = useI18n()
const hostLocale = computed(() => locale.value === 'ru' ? 'ru' as const : 'en' as const)

const FILTERS = computed(() => [
  { id: 'all' as const, label: t('settings.providers.catalog.filterAll') },
  { id: 'free' as const, label: t('settings.providers.catalog.free') },
  { id: 'vision' as const, label: t('settings.providers.shelf.vision') },
  { id: 'tools' as const, label: t('settings.providers.catalog.tools') },
])

const query = ref('')
const filter = ref<'all' | 'free' | 'vision' | 'tools'>('all')
const limit = ref(PAGE)

watch([query, filter], () => {
  limit.value = PAGE
})

const filtered = computed(() => {
  const models = searchCatalogModels(props.catalog?.models ?? [], query.value)
  if (filter.value === 'free') {
    return models.filter((model) => model.free)
  }
  if (filter.value === 'vision') {
    return models.filter((model) => model.vision)
  }
  if (filter.value === 'tools') {
    return models.filter((model) => model.tools)
  }
  return models
})

const visible = computed(() => filtered.value.slice(0, limit.value))

const tierRows = computed(() => tierSituations(hostLocale.value).map((situation) => {
  const bind = props.tierBinds[situation.tier]
  const copy = bindCopy(bind, props.providers, props.names)
  const here = bind?.providerId === props.providerId
  return {
    tier: situation.tier,
    title: situation.title,
    policy: !copy
      ? t('settings.providers.catalog.unset')
      : `${here ? '' : `${copy.provider} · `}${copy.pinned ? copy.policy : t('settings.providers.catalog.routing', { policy: copy.policy })}`,
    pinned: here && bind?.policy.kind === 'model',
  }
}))

const rawPolicy = computed(() => {
  const out: Record<string, unknown> = {}
  for (const tier of MODEL_TIERS) {
    out[tier] = props.tierBinds[tier] ?? null
  }
  return JSON.stringify(out, null, 2)
})

function pinnedTiers(modelId: string): ModelTier[] {
  return MODEL_TIERS.filter((tier) => {
    const bind = props.tierBinds[tier]
    return bind?.providerId === props.providerId
      && bind.policy.kind === 'model'
      && bind.policy.modelId === modelId
  })
}

function onPin(modelId: string, event: Event) {
  const select = event.target as HTMLSelectElement
  const tier = select.value
  select.value = ''
  if ((MODEL_TIERS as readonly string[]).includes(tier)) {
    emit('pin', tier as ModelTier, modelId)
  }
}
</script>

<style scoped>
.advanced {
  display: flex;
  flex-direction: column;
  gap: 1.3rem;
  padding-top: 0.4rem;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

h4 {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.95rem;
}

.count {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 0.78rem;
}

.hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.tier-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  overflow: hidden;
}

.tier-list li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.8rem;
  font-size: 0.85rem;
}

.tier-list li + li {
  border-top: 1px solid var(--line-soft);
}

code {
  flex: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  padding: 0.05rem 0.4rem;
  border-radius: 0.4rem;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  color: var(--text-muted);
}

.tier-title {
  flex: none;
  color: var(--text-muted);
}

.tier-policy {
  flex: 1;
  min-width: 0;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tier-policy.pinned {
  color: var(--accent);
}

.link {
  appearance: none;
  flex: none;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  text-decoration: underline;
  text-underline-offset: 2px;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.link:hover {
  color: var(--text);
}

.block-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.refresh {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.fetched {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.search {
  flex: 1 1 14rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0 0.8rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg);
}

.search:focus-within {
  outline: 1px solid var(--accent-dim);
}

.search svg {
  flex: none;
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: var(--text-muted);
  stroke-width: 1.8;
  stroke-linecap: round;
}

.search input {
  appearance: none;
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  padding: 0.55rem 0;
  outline: none;
}

.filters {
  display: flex;
  gap: 0.3rem;
}

.chip {
  appearance: none;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text-muted);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.chip.on {
  border-color: transparent;
  background: color-mix(in srgb, var(--accent) 22%, var(--surface));
  color: var(--accent-ink);
}

.models {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 26rem;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 0.9rem;
}

.model {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.8rem;
}

.model + .model {
  border-top: 1px solid var(--line-soft);
}

.model-copy {
  flex: 1;
  min-width: 0;
}

.model-name {
  margin: 0;
  font-weight: 700;
  font-size: 0.88rem;
}

.model-id {
  margin: 0.05rem 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-meta {
  margin: 0.3rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.65rem;
  font-size: 0.74rem;
  color: var(--text-muted);
}

.price {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.vision {
  color: color-mix(in srgb, var(--bot-accent-09) 60%, var(--text));
}

.warn {
  color: var(--bot-accent-04);
}

.pinned-on {
  margin: 0.3rem 0 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.74rem;
  color: var(--accent);
}

.pin select {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.pin select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.raw {
  margin: 0;
  padding: 0.8rem 0.9rem;
  max-height: 16rem;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  background: var(--bg);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.74rem;
  line-height: 1.5;
  color: var(--text-muted);
}
</style>
