<template>
  <section
    class="picker"
    aria-labelledby="bot-picker-title"
  >
    <header class="head">
      <HostMenuButton />
      <h2
        id="bot-picker-title"
        class="sr-only"
      >
        {{ isOwner ? 'Find or create a Bot' : 'Find a Bot' }}
      </h2>
      <label class="search">
        <span class="to">To:</span>
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
        class="back"
        aria-label="Back"
        @click="dismiss"
      >
        ×
      </button>
    </header>

    <div class="body">
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
  </section>
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
const searchEl = ref<HTMLInputElement | null>(null)

const visible = computed(() => filterBotsByName(props.bots, query.value))

useHead({
  title: computed(() => isOwner.value ? 'Dostigus · Find or create a Bot' : 'Dostigus · Find a Bot'),
})

function isCurrent(id: string): boolean {
  return String(route.params.id ?? '') === id
}

function dismiss() {
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

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return
  }
  dismiss()
}

onMounted(() => {
  searchEl.value?.focus()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.picker {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-chat);
  color: var(--text);
}

.head {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.85rem 1.15rem;
  border-bottom: 1px solid var(--line);
}

.head:focus-within {
  border-bottom-color: var(--accent);
}

.search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.to {
  flex: none;
  color: var(--text-muted);
  font-weight: 700;
  font-size: 1rem;
}

.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  padding: 0.35rem 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 1.05rem;
}

.search input:focus {
  outline: none;
}

.search input::placeholder {
  color: var(--text-muted);
}

.search input::-webkit-search-cancel-button {
  cursor: pointer;
}

.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.error,
.empty {
  margin: 0;
  padding: 0.85rem 1.25rem 0;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.error {
  color: var(--accent);
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0.55rem 0.6rem;
}

.row {
  appearance: none;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  text-align: left;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0.55rem 0.7rem;
  cursor: pointer;
}

.row:hover:not(:disabled),
.row.current {
  background: color-mix(in srgb, var(--text) 8%, transparent);
}

.row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.row:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.back {
  appearance: none;
  flex: none;
  width: 2.15rem;
  height: 2.15rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 1.45rem;
  line-height: 1;
  cursor: pointer;
}

.back:hover {
  color: var(--text);
}

.back:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.plus {
  width: 2.4rem;
  flex: none;
  text-align: center;
  color: var(--text-muted);
  font-size: 1.35rem;
  font-weight: 700;
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
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview {
  color: var(--text-muted);
  font-size: 0.85rem;
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
</style>
