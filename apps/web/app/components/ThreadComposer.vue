<template>
  <section
    class="composer"
    aria-labelledby="thread-composer-title"
  >
    <header class="head">
      <HostMenuButton />
      <h2
        id="thread-composer-title"
        class="kit-sr-only"
      >
        {{ heading }}
      </h2>
      <label class="search">
        <span class="to">{{ $t('host.threadCreate.to') }}</span>
        <KitInput
          ref="searchEl"
          v-model="query"
          type="search"
          :placeholder="kind === 'room' ? $t('host.threadCreate.findPersonOrBot') : $t('host.threadCreate.findPerson')"
          autocomplete="off"
          @keydown.enter.prevent
        />
      </label>
      <KitButton
        variant="close"
        :aria-label="$t('host.botPicker.back')"
        @click="dismiss"
      >
        ×
      </KitButton>
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

      <KitField
        v-if="kind !== 'dm'"
        class="title"
        :label="$t('host.threadCreate.titleLabel')"
        required
      >
        <KitInput
          v-model="title"
          maxlength="80"
          autocomplete="off"
          :placeholder="$t('host.threadCreate.titlePlaceholder')"
        />
      </KitField>

      <p
        v-if="kind === 'room'"
        class="hint"
      >
        {{ $t('host.threadCreate.botOptional') }}
      </p>
      <p
        v-if="others.length === 0"
        class="hint"
      >
        {{ $t('host.threadCreate.noOtherPeople') }}
      </p>
      <p
        v-else
        class="hint"
      >
        {{ $t('host.threadCreate.alreadyInChat') }}
      </p>

      <ul
        class="rows"
        :aria-label="kind === 'room' ? $t('host.threadCreate.peopleAndBot') : $t('host.threadCreate.people')"
      >
        <li
          v-for="person in visiblePeople"
          :key="person.id"
        >
          <KitListRow
            as="button"
            :selected="personIds.includes(person.id)"
            :aria-pressed="kind === 'dm' ? undefined : personIds.includes(person.id)"
            :disabled="busy"
            @click="togglePerson(person.id)"
          >
            <template #leading>
              <HostBotAvatar
                :name="person.displayName"
                :seed="person.id"
              />
            </template>
            <template #title>
              <span class="line">
                <span class="name">{{ person.displayName }}</span>
                <span class="tag">{{ $t('host.threadCreate.person') }}</span>
              </span>
            </template>
            <template
              v-if="kind !== 'dm'"
              #trailing
            >
              <span
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
            </template>
          </KitListRow>
        </li>
        <li
          v-for="bot in visibleBots"
          :key="bot.id"
        >
          <KitListRow
            as="button"
            :selected="botIds.includes(bot.id)"
            :aria-pressed="botIds.includes(bot.id)"
            :disabled="busy || botBlocked(bot.id)"
            :subtitle="botBlocked(bot.id) ? $t('host.threadCreate.noSharedAccess') : undefined"
            @click="toggleBot(bot.id)"
          >
            <template #leading>
              <HostBotAvatar
                :name="bot.name"
                :seed="bot.id"
                :shape="bot.manifest.avatarShape"
                :avatar-color="bot.manifest.avatarColor"
              />
            </template>
            <template #title>
              <span class="line">
                <span class="name">{{ bot.name }}</span>
                <span class="tag">Bot</span>
              </span>
            </template>
            <template #trailing>
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
            </template>
          </KitListRow>
        </li>
      </ul>

      <p
        v-if="visiblePeople.length === 0 && visibleBots.length === 0"
        class="hint"
      >
        {{ query.trim() ? $t('host.threadCreate.emptyPeople') : $t('host.threadCreate.emptyNone') }}
      </p>

      <KitButton
        v-if="kind !== 'dm'"
        type="submit"
        class="submit"
        :disabled="busy || !canSubmit"
      >
        {{ busy ? $t('host.threadCreate.submitBusy') : $t('host.threadCreate.submit') }}
      </KitButton>
    </form>
  </section>
</template>

<script setup lang="ts">
import type { HouseholdPerson, ThreadListItem } from '@dostigus/shared'
import { KitButton, KitField, KitInput, KitListRow } from '@dostigus/ui-kit'
import { hostStatusCopy } from '../utils/host-status-copy'

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
const searchEl = ref<InstanceType<typeof KitInput> | null>(null)

const { t } = useI18n()

const heading = computed(() => {
  if (kind.value === 'room') {
    return t('host.threadCreate.sheetRoom')
  }
  if (kind.value === 'group') {
    return t('host.threadCreate.sheetGroup')
  }
  return t('host.threadCreate.sheetDm')
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
  return hostStatusCopy(caught, t, 'host.threadCreate.createFailed')
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

.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.9rem 0.7rem 1.4rem;
}

.title {
  margin: 0 0.55rem;
}

.hint,
.error {
  margin: 0;
  padding: 0 0.7rem;
  line-height: 1.45;
}

.hint {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.error {
  color: var(--accent);
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
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
  font-size: 0.78rem;
  font-weight: 400;
}

.tick {
  display: grid;
  place-items: center;
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

.submit {
  align-self: flex-start;
  margin: 0.2rem 0.7rem 0;
}
</style>
