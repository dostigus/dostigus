<template>
  <section
    class="shelf"
    :aria-label="$t('settings.providers.shelf.aria')"
  >
    <div
      class="route"
      :class="{ on: mode === 'meta' }"
    >
      <div class="route-copy">
        <p class="route-title">
          {{ $t('settings.providers.shelf.routingOn') }}
        </p>
        <p class="route-detail">
          {{ $t('settings.providers.shelf.routingDetail') }}
        </p>
      </div>
      <KitChip
        v-if="mode === 'meta'"
        tone="ok"
      >
        {{ $t('settings.providers.shelf.now') }}
      </KitChip>
      <KitButton
        v-else
        variant="ghost"
        size="sm"
        :disabled="busy"
        @click="emit('meta')"
      >
        {{ $t('settings.providers.shelf.useRouting') }}
      </KitButton>
    </div>

    <div class="shelf-head">
      <p class="shelf-title">
        {{ $t('settings.providers.shelf.orPin') }}
      </p>
      <p class="shelf-sub">
        {{ ranking === 'fallback'
          ? $t('settings.providers.shelf.rankingFallback')
          : $t('settings.providers.shelf.rankingBenchmarks') }}
      </p>
    </div>

    <div
      v-if="loading && !catalog"
      class="cards"
      aria-busy="true"
    >
      <div
        v-for="slot in OPENROUTER_SHELF_SLOTS"
        :key="slot"
        class="card skeleton"
      >
        <span class="bar short" />
        <span class="bar" />
        <span class="bar mid" />
      </div>
    </div>

    <div
      v-else-if="!catalog || !catalog.ok"
      class="banner"
      role="alert"
    >
      <p class="banner-title">
        {{ catalogErrorCopy(catalog?.error ?? 'network', hostLocale) }}
      </p>
      <p class="banner-detail">
        {{ catalog?.keyAccepted === false
          ? $t('settings.providers.shelf.bannerKey')
          : $t('settings.providers.shelf.bannerGeneric') }}
      </p>
      <KitButton
        variant="ghost"
        size="sm"
        :disabled="loading"
        @click="emit('refresh')"
      >
        {{ loading ? $t('settings.providers.shelf.loading') : $t('common.retry') }}
      </KitButton>
    </div>

    <div
      v-else
      class="cards"
    >
      <article
        v-for="card in cards"
        :key="card.slot"
        class="card"
        :class="{ on: Boolean(card.pinnedId), empty: !card.top }"
      >
        <header class="card-head">
          <p class="slot">
            {{ OPENROUTER_SHELF_LABELS[card.slot] }}
          </p>
          <p class="tiers">
            <code
              v-for="tier in OPENROUTER_SHELF_TIERS[card.slot]"
              :key="tier"
            >{{ tier }}</code>
          </p>
        </header>
        <p class="use">
          {{ SLOT_COPY[card.slot].use }}
        </p>

        <template v-if="card.top">
          <div class="pick">
            <p
              class="name"
              :title="card.top.id"
            >
              {{ card.top.name }}
            </p>
            <p class="badges">
              <span class="price">{{ modelPriceCopy(card.top, hostLocale) }}</span>
              <KitChip
                v-if="scoreOf(card.slot, card.top) != null"
                :title="SLOT_COPY[card.slot].scoreTitle"
              >
                {{ SLOT_COPY[card.slot].scoreLabel }} {{ scoreOf(card.slot, card.top) }}
              </KitChip>
              <KitChip
                v-if="card.top.vision"
                :title="$t('settings.providers.shelf.understandsImages')"
              >
                {{ $t('settings.providers.shelf.vision') }}
              </KitChip>
            </p>
            <p class="why">
              {{ SLOT_COPY[card.slot].why }}
            </p>
          </div>

          <KitButton
            size="sm"
            :variant="card.pinnedId === card.top.id ? 'ghost' : 'solid'"
            :disabled="busy || card.pinnedId === card.top.id"
            @click="emit('pin', card.slot, card.top.id)"
          >
            {{ card.pinnedId === card.top.id ? $t('settings.providers.shelf.pinnedCheck') : $t('settings.providers.shelf.pin') }}
          </KitButton>

          <ul
            v-if="card.alts.length > 0"
            class="alts"
            :aria-label="$t('settings.providers.shelf.alts', { slot: OPENROUTER_SHELF_LABELS[card.slot] })"
          >
            <li
              v-for="alt in card.alts"
              :key="alt.id"
            >
              <KitListRow
                v-if="card.pinnedId === alt.id"
                selected
              >
                <template #title>
                  <span :title="alt.id">{{ alt.name }}</span>
                </template>
                <template #subtitle>
                  {{ altMeta(alt) }}
                </template>
                <template #trailing>
                  <span
                    class="alt-mark"
                    aria-hidden="true"
                  >✓</span>
                  <span class="kit-sr-only">{{ $t('settings.providers.shelf.pinned') }}</span>
                </template>
              </KitListRow>
              <KitListRow
                v-else
                as="button"
                :aria-label="$t('settings.providers.shelf.pinName', { name: alt.name })"
                :disabled="busy"
                @click="emit('pin', card.slot, alt.id)"
              >
                <template #title>
                  <span :title="alt.id">{{ alt.name }}</span>
                </template>
                <template #subtitle>
                  {{ altMeta(alt) }}
                </template>
                <template #trailing>
                  <span
                    class="alt-mark"
                    aria-hidden="true"
                  >+</span>
                </template>
              </KitListRow>
            </li>
          </ul>

          <p
            v-if="card.pinnedId && !card.shown"
            class="pinned-elsewhere"
          >
            {{ $t('settings.providers.shelf.currentlyPinned', { name: names[card.pinnedId] ?? card.pinnedId }) }}
          </p>
        </template>
        <p
          v-else
          class="none"
        >
          {{ $t('settings.providers.shelf.noModels') }}
        </p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  LlmTierBind,
  ModelTier,
  OpenRouterCatalogModel,
  OpenRouterCatalogPublic,
  OpenRouterShelfSlot,
} from '@dostigus/shared'
import {
  OPENROUTER_SHELF_LABELS,
  OPENROUTER_SHELF_SLOTS,
  OPENROUTER_SHELF_TIERS,
  openRouterRoutingMode,
  shelfSlotPin,
} from '@dostigus/shared'
import { KitButton, KitChip, KitListRow } from '@dostigus/ui-kit'
import { catalogErrorCopy, modelPriceCopy } from '../utils/provider-settings'

const props = defineProps<{
  providerId: string
  catalog: OpenRouterCatalogPublic | null
  loading: boolean
  busy: boolean
  tierBinds: Partial<Record<ModelTier, LlmTierBind>>
  names: Record<string, string>
}>()

const emit = defineEmits<{
  pin: [slot: OpenRouterShelfSlot, modelId: string]
  meta: []
  refresh: []
}>()

const { locale, t } = useI18n()
const hostLocale = computed(() => locale.value === 'ru' ? 'ru' as const : 'en' as const)

const SLOT_COPY = computed<Record<OpenRouterShelfSlot, {
  use: string
  why: string
  scoreLabel: string
  scoreTitle: string
}>>(() => ({
  free: {
    use: t('settings.providers.shelf.useFree'),
    why: t('settings.providers.shelf.whyFree'),
    scoreLabel: t('settings.providers.shelf.scoreIntelligence'),
    scoreTitle: t('settings.providers.shelf.scoreTitleIntelligence'),
  },
  smart: {
    use: t('settings.providers.shelf.useSmart'),
    why: t('settings.providers.shelf.whySmart'),
    scoreLabel: t('settings.providers.shelf.scoreIntelligence'),
    scoreTitle: t('settings.providers.shelf.scoreTitleIntelligence'),
  },
  coding: {
    use: t('settings.providers.shelf.useCoding'),
    why: t('settings.providers.shelf.whyCoding'),
    scoreLabel: t('settings.providers.shelf.scoreCoding'),
    scoreTitle: t('settings.providers.shelf.scoreTitleCoding'),
  },
}))

const mode = computed(() => openRouterRoutingMode(props.tierBinds, props.providerId))
const ranking = computed(() => props.catalog?.ranking ?? 'benchmarks')

const cards = computed(() => OPENROUTER_SHELF_SLOTS.map((slot) => {
  const ranked = props.catalog?.shelf[slot] ?? []
  const pinnedId = shelfSlotPin(props.tierBinds, props.providerId, slot)
  return {
    slot,
    top: ranked[0] ?? null,
    alts: ranked.slice(1),
    pinnedId,
    shown: pinnedId ? ranked.some((model) => model.id === pinnedId) : false,
  }
}))

function altMeta(model: OpenRouterCatalogModel): string {
  const price = modelPriceCopy(model, hostLocale.value)
  return model.vision ? `${price} · ${t('settings.providers.shelf.vision')}` : price
}

function scoreOf(slot: OpenRouterShelfSlot, model: OpenRouterCatalogModel): number | null {
  const value = slot === 'coding' ? (model.coding ?? model.intelligence) : model.intelligence
  return value == null ? null : Math.round(value)
}
</script>

<style scoped>
.shelf {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

/* Routing, shelf cards, and the miss banner are domain composites nested in the Provider KitPanel. A second KitPanel would be a card in a card. */
.route,
.card,
.banner {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg);
}

.route {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 0.9rem;
  padding: 0.95rem 1rem;
}

.route.on {
  border-color: color-mix(in srgb, var(--live) 45%, var(--line));
}

.route-copy {
  flex: 1 1 16rem;
  min-width: 0;
}

.route-title {
  margin: 0;
  font-weight: 700;
}

.route-detail {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
  line-height: 1.45;
}

.shelf-head {
  margin-top: 0.3rem;
}

.shelf-title {
  margin: 0;
  font-weight: 700;
}

.shelf-sub {
  margin: 0.15rem 0 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.7rem;
}

@container (min-width: 30rem) {
  .cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.95rem 0.95rem 0.85rem;
}

.card.on {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
}

.card-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.slot {
  margin: 0;
  font-weight: 800;
  font-size: 1.02rem;
  letter-spacing: 0.01em;
}

.tiers {
  margin: 0;
  display: flex;
  gap: 0.25rem;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  color: var(--text-muted);
}

.use {
  margin: -0.35rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.pick {
  width: 100%;
  min-width: 0;
  padding: 0.65rem 0.7rem;
  border-radius: var(--radius);
  background: var(--surface);
}

.name {
  margin: 0;
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.badges {
  margin: 0.4rem 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.74rem;
}

.price {
  color: var(--text);
  font-variant-numeric: tabular-nums;
  margin-right: 0.15rem;
}

.why {
  margin: 0.4rem 0 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.alts {
  list-style: none;
  width: 100%;
  margin: 0.1rem 0 0;
  padding: 0.35rem 0 0;
  border-top: 1px solid var(--line-soft);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

/* KitListRow pads 0.7rem inline; this lines alt names up with the card copy. */
.alts li {
  margin-inline: -0.7rem;
}

.alt-mark {
  color: var(--text);
  font-size: 1.2rem;
  line-height: 1;
}

.pinned-elsewhere,
.none {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.banner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.95rem 1rem;
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
}

.banner-title {
  margin: 0;
  font-weight: 700;
}

.banner-detail {
  margin: 0 0 0.35rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.skeleton {
  min-height: 11rem;
}

.bar {
  display: block;
  width: 85%;
  height: 0.8rem;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--surface), color-mix(in srgb, var(--text) 10%, var(--surface)), var(--surface));
  background-size: 200% 100%;
  animation: shelf-shimmer 1.3s linear infinite;
}

.bar.short {
  width: 35%;
}

.bar.mid {
  width: 60%;
}

@keyframes shelf-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bar {
    animation: none;
  }
}
</style>
