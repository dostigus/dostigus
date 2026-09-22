<template>
  <div
    ref="layerEl"
    class="layer"
    @click.self="requestClose"
  >
    <div
      class="panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bot-picker-title"
    >
      <header class="head">
        <h2
          id="bot-picker-title"
          class="sr-only"
        >
          {{ isOwner ? 'Find or create a Bot' : 'Find a Bot' }}
        </h2>
        <label class="search">
          <span class="to">To</span>
          <input
            ref="searchEl"
            v-model="query"
            type="search"
            :placeholder="isOwner ? 'Find or create a Bot' : 'Find a Bot'"
            autocomplete="off"
            @keydown.enter.prevent
          >
        </label>
        <button
          type="button"
          class="close"
          @click="requestClose"
        >
          Close
        </button>
      </header>

      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>

      <ul
        class="rows"
        aria-label="Bots"
      >
        <li v-if="isOwner">
          <button
            type="button"
            class="row"
            :disabled="busy"
            @click="createNew"
          >
            <span
              class="plus"
              aria-hidden="true"
            >+</span>
            <span class="copy">
              <span class="name">{{ busy ? 'Creating…' : 'Create new Bot' }}</span>
            </span>
          </button>
        </li>
        <li
          v-for="bot in visible"
          :key="bot.id"
        >
          <button
            type="button"
            class="row"
            :class="{ current: isCurrent(bot.id) }"
            @click="emit('openBot', bot.id)"
          >
            <HostBotAvatar
              :name="bot.name"
              :seed="bot.id"
              :shape="bot.manifest.avatarShape"
              :avatar-color="bot.manifest.avatarColor"
            />
            <span class="copy">
              <span class="name">{{ bot.name }}</span>
              <span
                v-if="bot.lastMessage?.content"
                class="preview"
              >{{ bot.lastMessage.content }}</span>
            </span>
          </button>
        </li>
      </ul>

      <p
        v-if="visible.length === 0 && (query.trim() || !isOwner)"
        class="empty"
      >
        {{ query.trim() ? 'No matching Bots.' : 'No Bots yet.' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Bot, BotListItem } from '@dostigus/shared'
import { DEFAULT_BOT_NAME, randomBotAppearance } from '@dostigus/shared'

const props = defineProps<{
  bots: BotListItem[]
}>()

const emit = defineEmits<{
  close: []
  created: [bot: Bot]
  openBot: [id: string]
}>()

const route = useRoute()
const { isOwner } = useHostAccount()

const query = ref('')
const busy = ref(false)
const error = ref('')
const layerEl = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)

const visible = computed(() => filterBotsByName(props.bots, query.value))

function isCurrent(id: string): boolean {
  return String(route.params.id ?? '') === id
}

function requestClose() {
  if (busy.value) {
    return
  }
  emit('close')
}

async function createNew() {
  if (!isOwner.value || busy.value) {
    return
  }
  busy.value = true
  error.value = ''
  const appearance = randomBotAppearance()
  try {
    const result = await $fetch<{ bot: Bot }>('/api/bots', {
      method: 'POST',
      body: {
        name: DEFAULT_BOT_NAME,
        avatarShape: appearance.avatarShape,
        avatarColor: appearance.avatarColor,
      },
    })
    emit('created', result.bot)
  } catch {
    error.value = 'Could not create Bot.'
    busy.value = false
  }
}

function onPointerDown(event: PointerEvent) {
  const layer = layerEl.value
  if (!layer || busy.value) {
    return
  }
  if (event.target instanceof Node && layer.contains(event.target)) {
    return
  }
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return
  }
  requestClose()
}

let stopped = false

onMounted(() => {
  searchEl.value?.focus()
  nextTick(() => {
    if (stopped) {
      return
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeydown)
  })
})

onUnmounted(() => {
  stopped = true
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.layer {
  position: absolute;
  inset: 0;
  z-index: 24;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 4.25rem 1.25rem 1.5rem;
  background: rgb(0 0 0 / 55%);
}

.panel {
  width: min(36rem, 100%);
  max-height: min(70dvh, 36rem);
  display: flex;
  flex-direction: column;
  background: var(--sheet);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  box-shadow: 0 18px 50px rgb(0 0 0 / 45%);
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 0.9rem 0.7rem;
}

.search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  height: 2.4rem;
  padding: 0 0.85rem;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--line);
}

.search:focus-within {
  border-color: var(--accent);
}

.to {
  flex: none;
  color: var(--text-muted);
  font-weight: 700;
  font-size: 0.92rem;
}

.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
}

.search input:focus {
  outline: none;
}

.search input::-webkit-search-cancel-button {
  cursor: pointer;
}

.close {
  appearance: none;
  flex: none;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.15rem 0.1rem;
  font: inherit;
  font-weight: 700;
}

.close:hover {
  color: var(--text);
}

.close:focus-visible,
.row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.error,
.empty {
  margin: 0;
  padding: 0.15rem 1.1rem 0.75rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.error {
  color: var(--accent);
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0.15rem 0.4rem 0.55rem;
  overflow: auto;
}

.row {
  appearance: none;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-align: left;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0.5rem 0.55rem;
  cursor: pointer;
}

.row:hover:not(:disabled),
.row.current {
  background: color-mix(in srgb, var(--text) 8%, transparent);
}

.row:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.plus {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  flex: none;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1;
}

.copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.name {
  font-weight: 700;
  font-size: 0.98rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview {
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

@media (max-width: 52rem) {
  .layer {
    padding: 3.25rem 0.75rem 1rem;
  }
}
</style>
