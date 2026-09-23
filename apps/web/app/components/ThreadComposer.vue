<template>
  <section
    class="composer"
    aria-labelledby="thread-composer-title"
  >
    <header class="head">
      <HostMenuButton />
      <h2 id="thread-composer-title">
        New thread
      </h2>
      <button
        type="button"
        class="back"
        aria-label="Back"
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
      <div
        class="kinds"
        role="radiogroup"
        aria-label="Thread kind"
      >
        <label
          v-for="option in kinds"
          :key="option.id"
          class="kind"
        >
          <input
            v-model="kind"
            type="radio"
            name="thread-kind"
            :value="option.id"
          >
          {{ option.label }}
        </label>
      </div>

      <label
        v-if="kind !== 'dm'"
        class="field"
      >
        <span>Name</span>
        <input
          v-model="title"
          type="text"
          maxlength="80"
          required
          autocomplete="off"
          placeholder="Name this Thread"
        >
      </label>

      <fieldset
        v-if="others.length > 0"
        class="people"
      >
        <legend>{{ kind === 'dm' ? 'Person' : 'People' }}</legend>
        <label
          v-for="person in others"
          :key="person.id"
          class="person"
        >
          <input
            v-if="kind === 'dm'"
            v-model="dmPersonId"
            type="radio"
            name="dm-person"
            :value="person.id"
          >
          <input
            v-else
            v-model="personIds"
            type="checkbox"
            :value="person.id"
          >
          <span>{{ person.displayName }}</span>
        </label>
      </fieldset>
      <p
        v-else
        class="hint"
      >
        A direct message needs another person in the Household.
      </p>

      <fieldset
        v-if="kind === 'room'"
        class="people"
      >
        <legend>Bots</legend>
        <p
          v-if="sharedBots.length === 0"
          class="hint"
        >
          A room needs a shared Bot. A private Bot stays off rooms.
        </p>
        <label
          v-for="bot in sharedBots"
          :key="bot.id"
          class="person"
        >
          <input
            v-model="botIds"
            type="checkbox"
            :value="bot.id"
          >
          <span>{{ bot.name }}</span>
        </label>
      </fieldset>

      <p
        v-if="kind === 'room'"
        class="hint"
      >
        In a room, mention a Bot with @Name so it replies.
      </p>

      <button
        type="submit"
        class="submit"
        :disabled="busy"
      >
        {{ busy ? 'Creating…' : 'Create thread' }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import type { HouseholdPerson, MessengerThreadKind, ThreadListItem } from '@dostigus/shared'

const emit = defineEmits<{
  close: []
  created: [thread: ThreadListItem]
}>()

const { user } = useHostAccount()
const { bots } = await useHostBots()
const { data: peopleData } = await useFetch<{ people: HouseholdPerson[] }>('/api/people')

const kinds: { id: MessengerThreadKind, label: string }[] = [
  { id: 'dm', label: 'Direct message' },
  { id: 'group', label: 'Group' },
  { id: 'room', label: 'Room' },
]

const kind = ref<MessengerThreadKind>('dm')
const title = ref('')
const dmPersonId = ref('')
const personIds = ref<string[]>([])
const botIds = ref<string[]>([])
const busy = ref(false)
const error = ref('')

const others = computed(() => {
  const people = peopleData.value?.people ?? []
  return people.filter((person) => person.id !== user.value?.id)
})

const sharedBots = computed(() => bots.value.filter((bot) => bot.visibility === 'shared'))

function dismiss() {
  emit('close')
}

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const selected = kind.value === 'dm'
      ? (dmPersonId.value ? [dmPersonId.value] : [])
      : personIds.value
    const created = await $fetch<{ thread: ThreadListItem }>('/api/threads', {
      method: 'POST',
      body: {
        kind: kind.value,
        title: title.value,
        personIds: selected,
        botIds: kind.value === 'room' ? botIds.value : [],
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
  return 'Could not create that Thread.'
}
</script>

<style scoped>
.composer {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-chat);
}

.head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

h2 {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 1.05rem;
}

.back {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
}

.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.1rem 1.15rem 2rem;
}

.kinds,
.people {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.kinds {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.kind,
.person,
.field {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.field {
  flex-direction: column;
  align-items: stretch;
}

.field span,
legend {
  color: var(--text-muted);
  font-size: 0.82rem;
}

input[type='text'] {
  font: inherit;
  color: inherit;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 0.55rem 0.7rem;
}

.hint,
.error {
  margin: 0;
  line-height: 1.45;
}

.hint {
  color: var(--text-muted);
}

.error {
  color: var(--accent);
}

.submit {
  align-self: flex-start;
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
</style>
