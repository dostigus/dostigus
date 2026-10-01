<template>
  <KitSheet
    v-model:open="open"
    edge="end"
    :title="mode === 'add' ? $t('host.threadRoster.addTitle') : $t('host.threadRoster.title')"
    title-align="center"
    close="icon"
  >
    <div
      v-if="mode === 'roster'"
      class="roster"
    >
      <KitListRow
        v-if="canAdd"
        as="button"
        class="add-row"
        :aria-label="$t('host.threadRoster.addAria')"
        @click="startAdd"
      >
        <template #leading>
          <span
            class="plus"
            aria-hidden="true"
          />
        </template>
        <template #title>
          {{ $t('host.threadRoster.add') }}
        </template>
      </KitListRow>
      <p
        v-else
        class="hint"
      >
        {{ $t('host.threadRoster.dmHint') }}
      </p>

      <section
        class="group"
        aria-labelledby="roster-people-heading"
      >
        <h2 id="roster-people-heading">
          {{ $t('host.threadRoster.people') }}
        </h2>
        <ul class="rows">
          <li
            v-for="person in people"
            :key="person.id"
          >
            <KitListRow>
              <template #leading>
                <HostBotAvatar
                  :name="person.name"
                  :seed="person.id"
                />
              </template>
              <template #title>
                <span class="line">
                  <span class="name">{{ person.name }}</span>
                  <span
                    v-if="person.id === viewerId"
                    class="tag"
                  >{{ $t('host.threadRoster.you') }}</span>
                </span>
              </template>
            </KitListRow>
          </li>
        </ul>
      </section>

      <section
        v-if="bots.length > 0"
        class="group"
        aria-labelledby="roster-bots-heading"
      >
        <h2 id="roster-bots-heading">
          {{ $t('host.threadRoster.bots') }}
        </h2>
        <ul class="rows">
          <li
            v-for="bot in bots"
            :key="bot.id"
          >
            <KitListRow>
              <template #leading>
                <HostBotAvatar
                  :name="bot.name"
                  :seed="bot.id"
                  :shape="bot.avatarShape ?? ''"
                  :avatar-color="bot.avatarColor"
                />
              </template>
              <template #title>
                <span class="line">
                  <span class="name">{{ bot.name }}</span>
                  <span class="tag">{{ $t('host.threadRoster.bot') }}</span>
                </span>
              </template>
            </KitListRow>
          </li>
        </ul>
      </section>
    </div>

    <div
      v-else
      class="add"
    >
      <KitButton
        variant="ghost"
        size="sm"
        class="back"
        :disabled="busy"
        @click="mode = 'roster'"
      >
        ‹ {{ $t('host.threadRoster.back') }}
      </KitButton>
      <KitInput
        ref="searchEl"
        v-model="query"
        type="search"
        autocomplete="off"
        :aria-label="$t('host.threadRoster.find')"
        :placeholder="$t('host.threadRoster.find')"
        @keydown.enter.prevent
      />
      <p class="hint">
        {{ $t('host.threadRoster.addHint') }}
      </p>
      <p
        v-if="error"
        class="note"
        role="alert"
      >
        <KitChip tone="warn">
          {{ error }}
        </KitChip>
      </p>
      <p
        v-if="loading"
        class="hint"
      >
        {{ $t('common.loading') }}
      </p>
      <template v-else-if="loaded">
        <ul
          v-if="visiblePeople.length > 0 || visibleBots.length > 0"
          class="rows"
          :aria-label="$t('host.threadRoster.addTitle')"
        >
          <li
            v-for="person in visiblePeople"
            :key="person.id"
          >
            <KitListRow
              as="button"
              class="candidate"
              :disabled="busy || personBlocked(person.id)"
              :subtitle="personBlocked(person.id) ? $t('host.threadRoster.noBotAccess') : undefined"
              @click="add('person', person.id)"
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
              <template #trailing>
                <span
                  v-if="pendingId === person.id"
                  class="tag"
                >{{ $t('host.threadRoster.adding') }}</span>
              </template>
            </KitListRow>
          </li>
          <li
            v-for="bot in visibleBots"
            :key="bot.id"
          >
            <KitListRow
              as="button"
              class="candidate"
              :disabled="busy || botBlocked(bot.id)"
              :subtitle="botBlocked(bot.id) ? $t('host.threadCreate.noSharedAccess') : undefined"
              @click="add('bot', bot.id)"
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
                  <span class="tag">{{ $t('host.threadRoster.bot') }}</span>
                </span>
              </template>
              <template #trailing>
                <span
                  v-if="pendingId === bot.id"
                  class="tag"
                >{{ $t('host.threadRoster.adding') }}</span>
              </template>
            </KitListRow>
          </li>
        </ul>
        <p
          v-else
          class="hint"
        >
          {{ query.trim() ? $t('host.threadRoster.noMatch') : $t('host.threadRoster.noneToAdd') }}
        </p>
      </template>
    </div>
  </KitSheet>
</template>

<script setup lang="ts">
import type { BotListItem, HouseholdPerson, ThreadListItem } from '@dostigus/shared'
import { KitButton, KitChip, KitInput, KitListRow, KitSheet } from '@dostigus/ui-kit'
import { hostStatusCopy } from '../utils/host-status-copy'

type RoomAudience = {
  botId: string
  personIds: string[]
}

const props = defineProps<{
  thread: ThreadListItem
  viewerId: string
}>()

const emit = defineEmits<{
  added: [thread: ThreadListItem]
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()

const mode = ref<'roster' | 'add'>('roster')
const query = ref('')
const loading = ref(false)
const loaded = ref(false)
const busy = ref(false)
const pendingId = ref('')
const error = ref('')
const household = ref<HouseholdPerson[]>([])
const openableBots = ref<BotListItem[]>([])
const audience = ref<RoomAudience[]>([])
const searchEl = ref<InstanceType<typeof KitInput> | null>(null)

const people = computed(() => props.thread.participants
  .filter((p) => p.kind === 'person')
  .sort((a, b) => Number(b.id === props.viewerId) - Number(a.id === props.viewerId) || a.name.localeCompare(b.name)))
const bots = computed(() => props.thread.participants
  .filter((p) => p.kind === 'bot')
  .sort((a, b) => a.name.localeCompare(b.name)))
const canAdd = computed(() => props.thread.kind === 'group' || props.thread.kind === 'room')

const visiblePeople = computed(() => {
  const here = new Set(people.value.map((p) => p.id))
  return household.value.filter((person) => !here.has(person.id) && matches(person.displayName))
})

const visibleBots = computed(() => {
  const here = new Set(bots.value.map((b) => b.id))
  return openableBots.value.filter((bot) => !here.has(bot.id) && matches(bot.name))
})

watch(open, (value) => {
  if (!value) {
    mode.value = 'roster'
    query.value = ''
    error.value = ''
  }
})

function matches(name: string) {
  const q = query.value.trim().toLowerCase()
  return !q || name.toLowerCase().includes(q)
}

function openers(botId: string): Set<string> | null {
  const row = audience.value.find((item) => item.botId === botId)
  return row ? new Set(row.personIds) : null
}

function botBlocked(botId: string) {
  const ids = openers(botId)
  return !ids || people.value.some((person) => !ids.has(person.id))
}

function personBlocked(personId: string) {
  return bots.value.some((bot) => !openers(bot.id)?.has(personId))
}

async function startAdd() {
  mode.value = 'add'
  error.value = ''
  query.value = ''
  loading.value = true
  try {
    const [peopleRes, botsRes, accessRes] = await Promise.all([
      $fetch<{ people: HouseholdPerson[] }>('/api/people'),
      $fetch<{ bots: BotListItem[] }>('/api/bots'),
      $fetch<{ bots: RoomAudience[] }>('/api/threads/room-access'),
    ])
    household.value = peopleRes.people
    openableBots.value = botsRes.bots
    audience.value = accessRes.bots
    loaded.value = true
  } catch {
    error.value = t('host.threadRoster.loadFailed')
  } finally {
    loading.value = false
  }
  await nextTick()
  searchEl.value?.focus()
}

async function add(kind: 'person' | 'bot', id: string) {
  if (busy.value || (kind === 'bot' ? botBlocked(id) : personBlocked(id))) {
    return
  }
  busy.value = true
  pendingId.value = id
  error.value = ''
  try {
    const res = await $fetch<{ thread: ThreadListItem }>(`/api/threads/${props.thread.id}/participants`, {
      method: 'POST',
      body: { kind, id },
    })
    emit('added', res.thread)
    mode.value = 'roster'
  } catch (caught) {
    error.value = hostStatusCopy(caught, t, 'host.threadRoster.addFailed')
  } finally {
    busy.value = false
    pendingId.value = ''
  }
}
</script>

<style scoped>
.roster,
.add {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--line);
}

.group h2 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-muted);
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

.plus {
  position: relative;
  display: block;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}

.plus::before,
.plus::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0.85rem;
  height: 2px;
  border-radius: 1px;
  background: currentcolor;
  transform: translate(-50%, -50%);
}

.plus::after {
  transform: translate(-50%, -50%) rotate(90deg);
}

.add-row :deep(.kit-row-title) {
  color: var(--accent);
}

.back {
  align-self: flex-start;
}

.hint,
.note {
  margin: 0;
  line-height: 1.45;
}

.hint {
  color: var(--text-muted);
  font-size: 0.85rem;
}
</style>
