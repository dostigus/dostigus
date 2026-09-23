<template>
  <div class="search-root">
    <KitDialog
      v-model:open="open"
      title="Поиск"
      wide
    >
      <template #title>
        <span class="search-title">
          <svg
            class="loupe"
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
          Поиск
        </span>
      </template>
      <div
        class="finder"
        @keydown="onKeydown"
      >
        <label class="query">
          <span class="sr-only">Search</span>
          <input
            v-model="query"
            type="search"
            placeholder="Bots, messages, Settings"
            autocomplete="off"
          >
        </label>
        <p
          v-if="hits.length === 0"
          class="empty"
        >
          {{ query.trim() ? 'No matches.' : 'No Bots yet' }}
        </p>
        <ul
          v-else
          ref="listEl"
          class="hits"
          role="listbox"
          aria-label="Search"
        >
          <li
            v-for="(hit, index) in hits"
            :key="hit.key"
          >
            <button
              type="button"
              class="hit"
              role="option"
              :aria-selected="index === active"
              :aria-label="hitLabel(hit)"
              @mouseenter="active = index"
              @click="choose(hit)"
            >
              <HostBotAvatar
                v-if="hit.kind !== 'settings'"
                :name="hit.title"
                :seed="hit.botId ?? hit.key"
                :shape="shapeOf(hit.botId)"
                :avatar-color="colorOf(hit.botId)"
                :live="hit.kind === 'bot' && hit.botId ? isLive(hit.botId) : false"
                size="md"
              />
              <span
                v-else
                class="settings-mark"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M5 7h14M5 12h14M5 17h10" />
                </svg>
              </span>
              <span class="copy">
                <span class="line">
                  <span class="name">{{ hit.title }}</span>
                  <span
                    v-if="hit.tag"
                    class="tag"
                  >{{ hit.tag }}</span>
                </span>
                <span
                  v-if="hit.subtitle"
                  class="sub"
                >{{ hit.subtitle }}</span>
              </span>
              <span
                v-if="hit.shortcut"
                class="key"
              >{{ hit.shortcut }}</span>
            </button>
          </li>
        </ul>
      </div>
    </KitDialog>
  </div>
</template>

<script setup lang="ts">
import type { HostSearchHit, HostSearchMessage } from '../utils/host-search'
import { KitDialog } from '@dostigus/ui-kit'
import { hostSearchHits, hostSearchShortcutIndex, hostSettingsCatalog } from '../utils/host-search'

const { open, closeSearch } = useHostSearch()
const { isOwner } = useHostAccount()
const { closeCreate } = useHostCreate()
const { requestOpen } = useHostBotSheet()
const { isLive } = useHostBotActivity()
const route = useRoute()
const { bots } = await useHostBots()

const query = ref('')
const active = ref(0)
const messages = ref<HostSearchMessage[]>([])
const listEl = ref<HTMLElement | null>(null)
let ticket = 0
let timer = 0

const routeBot = computed(() => {
  const id = route.params.id
  if (!route.path.startsWith('/bots/') || typeof id !== 'string' || !id) {
    return null
  }
  return bots.value.find((bot) => bot.id === id) ?? null
})

const hits = computed(() => hostSearchHits({
  query: query.value,
  bots: bots.value,
  messages: messages.value,
  settings: hostSettingsCatalog({
    isOwner: isOwner.value,
    bot: routeBot.value
      ? { id: routeBot.value.id, name: routeBot.value.name }
      : null,
  }),
}))

watch(open, (value) => {
  if (!value) {
    return
  }
  query.value = ''
  active.value = 0
})

watch(query, () => {
  active.value = 0
})

watch(hits, (list) => {
  if (active.value > list.length - 1) {
    active.value = Math.max(0, list.length - 1)
  }
})

watch(active, () => {
  nextTick(() => {
    listEl.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  })
})

watch([open, query], queueMessages)

onUnmounted(() => {
  window.clearTimeout(timer)
})

function queueMessages() {
  window.clearTimeout(timer)
  const q = query.value.trim()
  if (!open.value || !q) {
    ticket += 1
    messages.value = []
    return
  }
  const mine = ++ticket
  timer = window.setTimeout(() => {
    void loadMessages(q, mine)
  }, 140)
}

async function loadMessages(q: string, mine: number) {
  try {
    const data = await $fetch<{ messages: HostSearchMessage[] }>('/api/search/messages', {
      query: { q },
    })
    if (mine !== ticket) {
      return
    }
    messages.value = data.messages
  } catch {
    if (mine !== ticket) {
      return
    }
    messages.value = []
  }
}

function shapeOf(botId: string | null) {
  if (!botId) {
    return ''
  }
  return bots.value.find((bot) => bot.id === botId)?.manifest.avatarShape ?? ''
}

function colorOf(botId: string | null) {
  if (!botId) {
    return ''
  }
  return bots.value.find((bot) => bot.id === botId)?.manifest.avatarColor ?? ''
}

function hitLabel(hit: HostSearchHit): string {
  const parts = [hit.title]
  if (hit.tag) {
    parts.push(hit.tag)
  }
  if (hit.subtitle) {
    parts.push(hit.subtitle)
  }
  if (hit.shortcut) {
    parts.push(hit.shortcut)
  }
  return parts.join(', ')
}

async function choose(hit: HostSearchHit) {
  closeSearch()
  useHostNav().close()
  closeCreate()
  if (hit.kind === 'bot' && hit.botId) {
    await navigateTo(`/bots/${hit.botId}`)
    return
  }
  if (hit.kind === 'message' && hit.botId) {
    await navigateTo(`/bots/${hit.botId}`)
    return
  }
  if (hit.botId) {
    requestOpen(hit.botId)
    if (route.path !== `/bots/${hit.botId}`) {
      await navigateTo(`/bots/${hit.botId}`)
    }
    return
  }
  if (hit.href) {
    await navigateTo(hit.href)
  }
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey) {
    const index = hostSearchShortcutIndex(event.key)
    if (index == null) {
      return
    }
    const hit = hits.value.filter((item) => item.kind === 'bot')[index]
    if (!hit?.shortcut) {
      return
    }
    event.preventDefault()
    void choose(hit)
    return
  }
  if (hits.value.length === 0) {
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    active.value = Math.min(hits.value.length - 1, active.value + 1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = Math.max(0, active.value - 1)
    return
  }
  if (event.key === 'Enter') {
    const hit = hits.value[active.value]
    if (!hit) {
      return
    }
    event.preventDefault()
    void choose(hit)
  }
}
</script>

<style scoped>
.search-root {
  position: absolute;
  width: 0;
  height: 0;
  overflow: visible;
}

.search-title {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.loupe {
  width: 1.05rem;
  height: 1.05rem;
  flex: none;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.finder {
  --avatar-ring: var(--sheet);
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.query {
  display: flex;
}

.query input {
  width: 100%;
  appearance: none;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--text) 4%, transparent);
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
  padding: 0.55rem 0.75rem;
}

.query input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--text) 28%, var(--line));
}

.query input::placeholder {
  color: var(--text-muted);
}

.query input::-webkit-search-cancel-button {
  cursor: pointer;
}

.empty {
  margin: 0.35rem 0.4rem 0.5rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.hits {
  list-style: none;
  margin: 0;
  padding: 0.1rem;
  min-height: 0;
  overflow: auto;
  max-height: min(24rem, 52dvh);
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.hit {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-width: 0;
  padding: 0.42rem 0.5rem;
  border: 0;
  border-radius: 0.85rem;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.hit[aria-selected='true'] {
  background: color-mix(in srgb, var(--text) 9%, transparent);
}

.hit:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.settings-mark {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  flex: none;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-muted);
}

.settings-mark svg {
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.line {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  min-width: 0;
}

.name {
  font-weight: 700;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  flex: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.sub {
  color: var(--text-muted);
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.key {
  flex: none;
  color: var(--text-muted);
  font-size: 0.78rem;
  letter-spacing: 0.01em;
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
</style>
