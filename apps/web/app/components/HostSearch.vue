<template>
  <div class="search-root">
    <KitDialog
      v-model:open="open"
      :title="$t('host.search.title')"
      wide
      chrome="bare"
    >
      <div
        class="finder"
        @keydown="onKeydown"
      >
        <div class="query">
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
          <KitInput
            v-model="query"
            type="search"
            :aria-label="$t('host.search.aria')"
            :placeholder="$t('host.search.placeholder')"
            autocomplete="off"
          />
        </div>
        <p
          v-if="hits.length === 0"
          class="empty"
        >
          {{ query.trim() ? $t('host.search.emptyResults') : $t('host.search.emptyQuery') }}
        </p>
        <ul
          v-else
          ref="listEl"
          class="hits"
          role="listbox"
          :aria-label="$t('host.search.aria')"
        >
          <li
            v-for="(hit, index) in hits"
            :key="hit.key"
          >
            <KitListRow
              as="button"
              role="option"
              :selected="index === active"
              :aria-selected="index === active"
              :aria-label="hitLabel(hit)"
              :subtitle="hit.subtitle"
              @mouseenter="active = index"
              @click="choose(hit)"
            >
              <template #leading>
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
              </template>
              <template #title>
                <span class="line">
                  <span class="name">{{ hit.title }}</span>
                  <span
                    v-if="hit.tag"
                    class="tag"
                  >{{ hit.tag }}</span>
                </span>
              </template>
              <template
                v-if="hit.shortcut"
                #trailing
              >
                {{ hit.shortcut }}
              </template>
            </KitListRow>
          </li>
        </ul>
      </div>
    </KitDialog>
  </div>
</template>

<script setup lang="ts">
import type { HostSearchHit, HostSearchMessage } from '../utils/host-search'
import { KitDialog, KitInput, KitListRow } from '@dostigus/ui-kit'
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

const { locale } = useI18n()
const hostLocale = computed(() => locale.value === 'ru' ? 'ru' as const : 'en' as const)
const hits = computed(() => hostSearchHits({
  query: query.value,
  bots: bots.value,
  messages: messages.value,
  locale: hostLocale.value,
  settings: hostSettingsCatalog({
    isOwner: isOwner.value,
    bot: routeBot.value
      ? { id: routeBot.value.id, name: routeBot.value.name }
      : null,
    locale: hostLocale.value,
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
  if (hit.kind === 'message') {
    if (hit.href) {
      await navigateTo(hit.href)
      return
    }
    if (hit.botId) {
      await navigateTo(`/bots/${hit.botId}`)
    }
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

.loupe {
  position: absolute;
  inset-inline-start: 0.9rem;
  top: 50%;
  width: 1.05rem;
  height: 1.05rem;
  transform: translateY(-50%);
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
  pointer-events: none;
}

.finder {
  --avatar-ring: var(--sheet);
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.query {
  position: relative;
  color: var(--text-muted);
}

.query:focus-within {
  color: var(--text);
}

.query .kit-input {
  padding-inline-start: 2.45rem;
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

.line {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  min-width: 0;
}

.name {
  min-width: 0;
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
</style>
