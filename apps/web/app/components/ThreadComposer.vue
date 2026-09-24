<template>
  <section
    class="composer"
    aria-labelledby="thread-composer-title"
  >
    <header class="head">
      <HostMenuButton />
      <h2
        id="thread-composer-title"
        class="sr-only"
      >
        {{ heading }}
      </h2>
      <label class="search">
        <span class="to">Кому:</span>
        <input
          ref="searchEl"
          v-model="query"
          type="search"
          :placeholder="kind === 'room' ? 'Найти человека или Bot' : 'Найти человека'"
          autocomplete="off"
          @keydown.enter.prevent
        >
      </label>
      <button
        type="button"
        class="back"
        aria-label="Назад"
        @click="dismiss"
      >
        ×
      </button>
    </header>

    <form
      class="body"
      @submit.prevent="submit"
    >
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>

      <label
        v-if="kind !== 'dm'"
        class="field"
      >
        <span>Название</span>
        <input
          v-model="title"
          type="text"
          maxlength="80"
          required
          autocomplete="off"
          placeholder="Название чата"
        >
      </label>

      <p
        v-if="kind === 'room'"
        class="hint"
      >
        Bot можно не выбирать. Он попадает в чат, только если его уже видит каждый человек. Создать чат не выдаёт доступ.
      </p>
      <p
        v-if="others.length === 0"
        class="hint"
      >
        В Household пока нет других людей.
      </p>
      <p
        v-else
        class="hint"
      >
        Вы уже в этом чате.
      </p>

      <ul
        class="rows"
        :aria-label="kind === 'room' ? 'Люди и Bot' : 'Люди'"
      >
        <li
          v-for="person in visiblePeople"
          :key="person.id"
        >
          <button
            type="button"
            class="row"
            :class="{ current: personIds.includes(person.id) }"
            :aria-pressed="kind === 'dm' ? undefined : personIds.includes(person.id)"
            :disabled="busy"
            @click="togglePerson(person.id)"
          >
            <HostBotAvatar
              :name="person.displayName"
              :seed="person.id"
            />
            <span class="copy">
              <span class="name-row">
                <span class="name">{{ person.displayName }}</span>
                <span class="tag">человек</span>
              </span>
            </span>
            <span
              v-if="kind !== 'dm'"
              class="tick"
              :class="{ on: personIds.includes(person.id) }"
              aria-hidden="true"
            >
              <svg
                v-if="personIds.includes(person.id)"
                viewBox="0 0 24 24"
              >
                <path d="M6 12.5l4 4 8-8.5" />
              </svg>
            </span>
          </button>
        </li>
        <li
          v-for="bot in visibleBots"
          :key="bot.id"
        >
          <button
            type="button"
            class="row"
            :class="{ current: botIds.includes(bot.id) }"
            :aria-pressed="botIds.includes(bot.id)"
            :disabled="busy || botBlocked(bot.id)"
            @click="toggleBot(bot.id)"
          >
            <HostBotAvatar
              :name="bot.name"
              :seed="bot.id"
              :shape="bot.manifest.avatarShape"
              :avatar-color="bot.manifest.avatarColor"
            />
            <span class="copy">
              <span class="name-row">
                <span class="name">{{ bot.name }}</span>
                <span class="tag">Bot</span>
              </span>
              <span
                v-if="botBlocked(bot.id)"
                class="preview"
              >Нет доступа у всех</span>
            </span>
            <span
              class="tick"
              :class="{ on: botIds.includes(bot.id) }"
              aria-hidden="true"
            >
              <svg
                v-if="botIds.includes(bot.id)"
                viewBox="0 0 24 24"
              >
                <path d="M6 12.5l4 4 8-8.5" />
              </svg>
            </span>
          </button>
        </li>
      </ul>

      <p
        v-if="visiblePeople.length === 0 && visibleBots.length === 0"
        class="hint"
      >
        {{ query.trim() ? 'Никого не нашлось.' : 'Некого добавить.' }}
      </p>

      <button
        v-if="kind !== 'dm'"
        type="submit"
        class="submit"
        :disabled="busy || !canSubmit"
      >
        {{ busy ? 'Создаём…' : 'Создать' }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import type { HouseholdPerson, ThreadListItem } from '@dostigus/shared'

type RoomAudience = {
  botId: string
  personIds: string[]
}

const emit = defineEmits<{
  close: []
  created: [thread: ThreadListItem]
}>()

const { user } = useHostAccount()
const { kind } = useHostThreadCreate()
const { bots } = await useHostBots()
const { data: peopleData } = await useFetch<{ people: HouseholdPerson[] }>('/api/people')
const { data: accessData } = await useFetch<{ bots: RoomAudience[] }>('/api/threads/room-access')

const title = ref('')
const query = ref('')
const personIds = ref<string[]>([])
const botIds = ref<string[]>([])
const busy = ref(false)
const error = ref('')
const searchEl = ref<HTMLInputElement | null>(null)

const heading = computed(() => {
  if (kind.value === 'room') {
    return 'Групповой чат'
  }
  if (kind.value === 'group') {
    return 'Группа'
  }
  return 'Личное сообщение'
})

const others = computed(() => {
  const people = peopleData.value?.people ?? []
  return people.filter((person) => person.id !== user.value?.id)
})

const audience = computed(() => accessData.value?.bots ?? [])

const visiblePeople = computed(() => {
  return others.value.filter((person) => matches(person.displayName))
})

const visibleBots = computed(() => {
  if (kind.value !== 'room') {
    return []
  }
  return bots.value.filter((bot) => matches(bot.name))
})

const canSubmit = computed(() => {
  return title.value.trim().length > 0 && personIds.value.length > 0
})

watch(personIds, () => {
  botIds.value = botIds.value.filter((id) => !botBlocked(id))
})

useHead({
  title: computed(() => `Dostigus · ${heading.value}`),
})

function matches(name: string) {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    return true
  }
  return name.toLowerCase().includes(q)
}

function botBlocked(botId: string) {
  if (personIds.value.length === 0) {
    return false
  }
  const row = audience.value.find((item) => item.botId === botId)
  if (!row) {
    return true
  }
  const openIds = new Set(row.personIds)
  return personIds.value.some((id) => !openIds.has(id))
}

function dismiss() {
  if (busy.value) {
    return
  }
  emit('close')
}

function togglePerson(id: string) {
  if (busy.value) {
    return
  }
  if (kind.value === 'dm') {
    void createThread('dm', [id], [])
    return
  }
  const next = new Set(personIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  personIds.value = [...next]
}

function toggleBot(id: string) {
  if (busy.value || botBlocked(id)) {
    return
  }
  const next = new Set(botIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  botIds.value = [...next]
}

function submit() {
  if (!canSubmit.value) {
    return
  }
  const selectedBots = kind.value === 'room'
    ? botIds.value.filter((id) => !botBlocked(id))
    : []
  const postedKind = kind.value === 'room' && selectedBots.length === 0
    ? 'group'
    : kind.value
  void createThread(postedKind, personIds.value, selectedBots)
}

async function createThread(
  postedKind: 'dm' | 'group' | 'room',
  people: string[],
  selectedBots: string[],
) {
  error.value = ''
  busy.value = true
  try {
    const created = await $fetch<{ thread: ThreadListItem }>('/api/threads', {
      method: 'POST',
      body: {
        kind: postedKind,
        title: title.value,
        personIds: people,
        botIds: selectedBots,
      },
    })
    emit('created', created.thread)
  } catch (caught) {
    error.value = errorText(caught)
  } finally {
    busy.value = false
  }
}

function errorText(caught: unknown): string {
  const message = statusMessage(caught)
  if (message === 'Every person in the room must already have access to that Bot') {
    return 'У каждого человека в чате уже должен быть доступ к этому Bot. Доступ сам не выдаётся.'
  }
  if (message === 'A room needs a Bot') {
    return 'Выберите Bot.'
  }
  if (message === 'A room needs at least two people' || message === 'A group needs at least two people') {
    return 'Выберите хотя бы одного человека.'
  }
  if (message === 'A direct message is one person and another person') {
    return 'Выберите человека.'
  }
  if (message === 'Name this Thread') {
    return 'Назовите чат.'
  }
  if (message) {
    return message
  }
  return 'Не удалось создать чат.'
}

function statusMessage(caught: unknown): string {
  if (caught && typeof caught === 'object' && 'statusMessage' in caught) {
    const message = (caught as { statusMessage?: string }).statusMessage
    if (message) {
      return message
    }
  }
  if (caught && typeof caught === 'object' && 'data' in caught) {
    const data = (caught as { data?: { statusMessage?: string } }).data
    if (data?.statusMessage) {
      return data.statusMessage
    }
  }
  return ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || busy.value) {
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
.composer {
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

.search input,
.field input {
  font: inherit;
  color: inherit;
}

.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  padding: 0.35rem 0;
  background: transparent;
  font-size: 1.05rem;
}

.search input:focus,
.field input:focus {
  outline: none;
}

.search input::placeholder,
.field input::placeholder {
  color: var(--text-muted);
}

.search input::-webkit-search-cancel-button {
  cursor: pointer;
}

.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.9rem 0.7rem 1.4rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0 0.55rem;
}

.field span,
.hint,
.error {
  margin: 0;
  line-height: 1.45;
}

.field span,
.hint {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.field input {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 0.55rem 0.7rem;
}

.field input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.hint,
.error {
  padding: 0 0.7rem;
}

.error {
  color: var(--accent);
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
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
  padding: 0.5rem 0.65rem;
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
  opacity: 0.55;
  cursor: not-allowed;
}

.copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.name-row {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.name {
  min-width: 0;
  font-weight: 700;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag,
.preview {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 400;
}

.tag {
  flex: none;
}

.preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tick {
  display: grid;
  place-items: center;
  flex: none;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 999px;
  border: 1.5px solid var(--line);
  color: var(--accent-ink);
}

.tick svg {
  width: 0.75rem;
  height: 0.75rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tick.on {
  border-color: var(--accent);
  background: var(--accent);
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

.submit {
  align-self: flex-start;
  margin: 0.2rem 0.7rem 0;
  appearance: none;
  border: 0;
  border-radius: 999px;
  padding: 0.55rem 1rem;
  background: var(--accent);
  color: var(--accent-ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
