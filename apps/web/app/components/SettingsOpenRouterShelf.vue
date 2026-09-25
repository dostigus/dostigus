<template>
  <section
    class="shelf"
    aria-label="Модели OpenRouter"
  >
    <button
      type="button"
      class="route"
      :class="{ on: mode === 'meta' }"
      :aria-pressed="mode === 'meta'"
      :disabled="busy || mode === 'meta'"
      @click="emit('meta')"
    >
      <span
        class="radio"
        aria-hidden="true"
      />
      <span class="route-copy">
        <span class="route-title">
          {{ mode === 'meta' ? 'Маршрутизация OpenRouter' : 'Оставить маршрутизацию OpenRouter' }}
          <span
            v-if="mode === 'meta'"
            class="now"
          >Сейчас</span>
        </span>
        <span class="route-detail">
          OpenRouter сам выбирает модель: Free для Wake и песочницы, Auto для Chat.
          Настраивать ничего не нужно.
        </span>
      </span>
    </button>

    <div class="shelf-head">
      <p class="shelf-title">
        Или закрепите модель
      </p>
      <p class="shelf-sub">
        {{ ranking === 'fallback'
          ? 'OpenRouter не прислал оценки качества — показаны самые новые модели.'
          : 'Рейтинг из живого каталога OpenRouter по индексам Artificial Analysis и цене.' }}
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
        {{ catalogErrorCopy(catalog?.error ?? 'network') }}
      </p>
      <p class="banner-detail">
        {{ catalog?.keyAccepted === false
          ? 'Полка моделей появится, когда OpenRouter примет ключ.'
          : 'Полка моделей недоступна. Bots продолжают думать через маршрутизацию OpenRouter.' }}
      </p>
      <KitButton
        variant="ghost"
        size="sm"
        :disabled="loading"
        @click="emit('refresh')"
      >
        {{ loading ? 'Загружаем…' : 'Попробовать снова' }}
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
              <span class="price">{{ modelPriceCopy(card.top) }}</span>
              <span
                v-if="scoreOf(card.slot, card.top) != null"
                class="badge"
                :title="SLOT_COPY[card.slot].scoreTitle"
              >{{ SLOT_COPY[card.slot].scoreLabel }} {{ scoreOf(card.slot, card.top) }}</span>
              <span
                v-if="card.top.vision"
                class="badge vision"
                title="Понимает изображения"
              >Vision</span>
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
            {{ card.pinnedId === card.top.id ? '✓ Закреплено' : 'Закрепить' }}
          </KitButton>

          <ul
            v-if="card.alts.length > 0"
            class="alts"
            :aria-label="`Другие варианты ${OPENROUTER_SHELF_LABELS[card.slot]}`"
          >
            <li
              v-for="alt in card.alts"
              :key="alt.id"
              :class="{ on: card.pinnedId === alt.id }"
            >
              <span class="alt-copy">
                <span
                  class="alt-name"
                  :title="alt.id"
                >{{ alt.name }}</span>
                <span class="alt-meta">
                  {{ modelPriceCopy(alt) }}<template v-if="alt.vision"> · Vision</template>
                </span>
              </span>
              <button
                type="button"
                class="alt-pin"
                :aria-label="card.pinnedId === alt.id ? `${alt.name} закреплена` : `Закрепить ${alt.name}`"
                :title="card.pinnedId === alt.id ? 'Закреплена' : 'Закрепить'"
                :disabled="busy || card.pinnedId === alt.id"
                @click="emit('pin', card.slot, alt.id)"
              >
                <svg
                  v-if="card.pinnedId === alt.id"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M6.5 12.5l3.6 3.5L17.5 8.5" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </li>
          </ul>

          <p
            v-if="card.pinnedId && !card.shown"
            class="pinned-elsewhere"
          >
            Сейчас закреплена: {{ names[card.pinnedId] ?? card.pinnedId }}
          </p>
        </template>
        <p
          v-else
          class="none"
        >
          Подходящих моделей в каталоге сейчас нет.
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
import { KitButton } from '@dostigus/ui-kit'
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

const SLOT_COPY: Record<OpenRouterShelfSlot, {
  use: string
  why: string
  scoreLabel: string
  scoreTitle: string
}> = {
  free: {
    use: 'Wake, Schedules и песочница',
    why: 'Самая умная из бесплатных.',
    scoreLabel: 'Интеллект',
    scoreTitle: 'Artificial Analysis Intelligence Index',
  },
  smart: {
    use: 'Каждый ответ в Chat',
    why: 'Самая умная без премиальной цены.',
    scoreLabel: 'Интеллект',
    scoreTitle: 'Artificial Analysis Intelligence Index',
  },
  coding: {
    use: 'Вторая попытка, если ответ не вышел',
    why: 'Лучшая в коде без премиальной цены.',
    scoreLabel: 'Код',
    scoreTitle: 'Artificial Analysis Coding Index',
  },
}

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

.route {
  appearance: none;
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  width: 100%;
  padding: 0.95rem 1rem;
  border: 1px solid var(--line);
  border-radius: 1.1rem;
  background: var(--bg);
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.route:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--text) 28%, var(--line));
}

.route.on {
  border-color: color-mix(in srgb, var(--live) 45%, var(--line));
  background: color-mix(in srgb, var(--live) 6%, var(--bg));
}

.route:disabled {
  cursor: default;
}

.route:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.radio {
  flex: none;
  width: 1.05rem;
  height: 1.05rem;
  margin-top: 0.15rem;
  border-radius: 999px;
  border: 2px solid var(--text-muted);
}

.route.on .radio {
  border-color: var(--live);
  background: radial-gradient(circle, var(--live) 0 45%, transparent 50%);
}

.route-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.route-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
}

.now {
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--live) 18%, transparent);
  color: var(--live);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.route-detail {
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
  border: 1px solid var(--line);
  border-radius: 1.1rem;
  background: var(--bg);
}

.card.on {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent);
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
  padding: 0.05rem 0.4rem;
  border-radius: 0.4rem;
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
  border-radius: 0.85rem;
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

.badge {
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--text-muted);
}

.badge.vision {
  border-color: transparent;
  background: color-mix(in srgb, var(--bot-accent-09) 22%, transparent);
  color: color-mix(in srgb, var(--bot-accent-09) 60%, var(--text));
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

.alts li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.3rem 0;
}

.alt-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.alt-name {
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alt-meta {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.alt-pin {
  appearance: none;
  display: grid;
  place-items: center;
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  border-radius: 999px;
  cursor: pointer;
}

.alt-pin:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--text) 30%, var(--line));
}

.alt-pin svg {
  width: 0.9rem;
  height: 0.9rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.alts li.on .alt-pin {
  border-color: transparent;
  color: var(--accent);
}

.alt-pin:disabled {
  cursor: default;
  opacity: 0.7;
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
  border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--line));
  border-radius: 1.1rem;
  background: color-mix(in srgb, var(--accent) 8%, var(--bg));
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
