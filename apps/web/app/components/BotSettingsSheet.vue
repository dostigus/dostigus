<template>
  <KitSheet
    v-model:open="open"
    edge="end"
    :title="$t('closet.title')"
    title-align="center"
    close="icon"
  >
    <div
      v-if="bot"
      class="mark"
    >
      <KitBotAvatar
        :shape="bot.manifest.avatarShape"
        :color="bot.manifest.avatarColor"
        size="lg"
        :state="heroState"
      />
      <button
        v-if="canEdit"
        type="button"
        class="hero"
        :aria-label="$t('closet.changeAvatar')"
        @click="openAppearance"
      />
      <button
        v-if="canEdit"
        type="button"
        class="pencil"
        :aria-label="$t('closet.changeAvatar')"
        @click="openAppearance"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M4 20l4.1-.8L19.2 8.1a1.6 1.6 0 0 0 0-2.3l-.9-.9a1.6 1.6 0 0 0-2.3 0L4.8 15.9 4 20z" />
          <path d="M13.6 6.4l4 4" />
        </svg>
      </button>
    </div>

    <form
      v-if="bot"
      class="form"
      @submit.prevent="persistFields"
    >
      <label class="field">
        <span>{{ $t('closet.name') }}</span>
        <input
          v-model="name"
          type="text"
          maxlength="120"
          autocomplete="off"
          required
          :disabled="!canEdit || saving"
          @blur="persistFields"
        >
      </label>
      <label class="field">
        <span>{{ $t('closet.labelOptional') }}</span>
        <input
          v-model="label"
          type="text"
          maxlength="160"
          autocomplete="off"
          :placeholder="$t('closet.labelPlaceholder')"
          :disabled="!canEdit || saving"
          @blur="persistFields"
        >
      </label>
      <label class="field">
        <span>{{ $t('closet.description') }}</span>
        <textarea
          v-model="description"
          maxlength="2000"
          rows="5"
          :placeholder="$t('closet.descriptionPlaceholder')"
          :disabled="!canEdit || saving"
          @blur="persistFields"
        />
      </label>
      <section
        class="schedules"
        aria-labelledby="schedules-heading"
      >
        <div class="schedules-head">
          <h2 id="schedules-heading">
            {{ $t('closet.schedules') }}
          </h2>
          <button
            type="button"
            class="add"
            :aria-label="$t('closet.addSchedule')"
            @click="openCreate"
          >
            +
          </button>
        </div>
        <p
          v-if="schedulesError"
          class="error"
        >
          {{ schedulesError }}
        </p>
        <p
          v-else-if="schedulesLoading"
          class="hint"
        >
          {{ $t('closet.loading') }}
        </p>
        <div
          v-else-if="schedules.length === 0"
          class="schedules-empty"
        >
          <p class="hint">
            {{ $t('closet.noSchedules') }}
          </p>
          <button
            type="button"
            class="grant-all"
            @click="openCreate"
          >
            {{ $t('closet.add') }}
          </button>
        </div>
        <ul
          v-else
          class="schedules-list"
        >
          <li
            v-for="row in schedules"
            :key="row.id"
          >
            <button
              type="button"
              class="schedule-row"
              :class="{ paused: row.paused }"
              @click="openDetail(row)"
            >
              <span class="schedule-copy">
                <span class="schedule-name">{{ scheduleDisplayName(row) }}</span>
                <span class="schedule-cadence">{{ scheduleCadenceLabel(row, hostLocale) }}</span>
              </span>
              <span
                class="chevron"
                aria-hidden="true"
              >›</span>
            </button>
          </li>
        </ul>
      </section>
      <div
        v-if="canEdit"
        class="field"
      >
        <span>{{ $t('closet.whoSees') }}</span>
        <p class="hint">
          {{ $t('closet.whoSeesHint') }}
        </p>
        <p
          v-if="sharePeople.length === 0"
          class="hint"
        >
          {{ $t('closet.noOtherMembers') }}
        </p>
        <label
          v-for="person in sharePeople"
          :key="person.id"
          class="grant"
        >
          <input
            type="checkbox"
            :checked="grantedIds.has(person.id)"
            :disabled="grantBusy"
            @change="onGrantChange(person.id, $event)"
          >
          <span>{{ person.displayName }}</span>
        </label>
        <button
          v-if="sharePeople.length > 0"
          type="button"
          class="grant-all"
          :disabled="grantBusy"
          @click="grantEveryone"
        >
          {{ $t('closet.grantAll') }}
        </button>
      </div>
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
    </form>
  </KitSheet>

  <KitDialog
    v-model:open="appearanceOpen"
    :title="$t('closet.avatar')"
    title-align="center"
    close="icon"
  >
    <div
      v-if="bot"
      class="editor"
    >
      <div
        class="shapes"
        role="group"
        :aria-label="$t('closet.bird')"
      >
        <button
          v-for="item in shapes"
          :key="item"
          type="button"
          class="shape"
          :class="{ selected: draftShape === item }"
          :disabled="appearanceSaving"
          :aria-label="shapeLabel(item)"
          :aria-pressed="draftShape === item"
          @click="pickShape(item)"
        >
          <KitBotAvatar
            :shape="item"
            :color="draftColor"
            size="lg"
            :state="markState(item)"
          />
        </button>
      </div>

      <div
        class="swatches"
        role="group"
        :aria-label="$t('closet.color')"
      >
        <button
          v-for="swatch in accents"
          :key="swatch.hex"
          type="button"
          class="swatch"
          :class="{ selected: draftColor === swatch.hex }"
          :style="{ background: `var(${swatch.cssVar})` }"
          :disabled="appearanceSaving"
          :aria-label="$t('closet.colorToken', { token: swatch.token })"
          :aria-pressed="draftColor === swatch.hex"
          @click="pickColor(swatch.hex)"
        />
      </div>

      <p
        v-if="appearanceError"
        class="error"
      >
        {{ appearanceError }}
      </p>

      <div class="actions">
        <button
          type="button"
          class="reset"
          :disabled="appearanceSaving"
          @click="resetAppearance"
        >
          {{ $t('closet.reset') }}
        </button>
        <KitButton
          type="button"
          :disabled="appearanceSaving"
          @click="saveAppearance"
        >
          {{ appearanceSaving ? $t('closet.saving') : $t('closet.save') }}
        </KitButton>
      </div>
    </div>
  </KitDialog>

  <KitSheet
    v-model:open="createOpen"
    edge="end"
    :title="$t('closet.newSchedule')"
    title-align="center"
    close="icon"
  >
    <ScheduleSheet
      v-if="bot && createOpen"
      mode="create"
      :bot-id="bot.id"
      @created="onScheduleCreated"
    />
  </KitSheet>

  <KitSheet
    v-model:open="detailOpen"
    edge="end"
    :title="detailTitle"
    title-align="center"
    close="icon"
  >
    <ScheduleSheet
      v-if="detailId && detailOpen"
      :schedule-id="detailId"
      @saved="void loadSchedules()"
      @deleted="onScheduleDeleted"
      @titled="detailTitle = $event"
    />
  </KitSheet>
</template>

<script setup lang="ts">
import type { Bot, BotAccentHex, BotAvatarShape, BotAvatarState, HouseholdPerson } from '@dostigus/shared'
import {
  BOT_ACCENT_TOKENS,
  BOT_AVATAR_SHAPES,
  canEditBot,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_SHAPE,
} from '@dostigus/shared'
import { KitBotAvatar, KitButton, KitDialog, KitSheet } from '@dostigus/ui-kit'
import { scheduleCadenceLabel, scheduleDisplayName } from '../utils/schedule-copy'

const props = defineProps<{
  bot: Bot | undefined
}>()

const emit = defineEmits<{
  saved: []
}>()

const { locale, t } = useI18n()
const hostLocale = computed(() => locale.value === 'ru' ? 'ru' as const : 'en' as const)

const open = defineModel<boolean>('open', { required: true })

const { user, isOwner } = useHostAccount()
const canEdit = computed(() => {
  if (!props.bot || !user.value?.id) {
    return false
  }
  return canEditBot(props.bot, {
    id: user.value.id,
    role: isOwner.value ? 'owner' : 'member',
  })
})
const shapes = BOT_AVATAR_SHAPES
const accents = BOT_ACCENT_TOKENS
const name = ref('')
const label = ref('')
const description = ref('')
const saving = ref(false)
const error = ref('')
const appearanceOpen = ref(false)
const draftShape = ref<BotAvatarShape>(DEFAULT_AVATAR_SHAPE)
const draftColor = ref<BotAccentHex>(DEFAULT_AVATAR_COLOR)
const appearanceSaving = ref(false)
const appearanceError = ref('')
const heroGreet = ref(false)
const picked = ref(false)

type GrantRow = { personId: string, displayName: string }
type ScheduleRow = {
  id: string
  name: string
  cadence: 'daily' | 'weekly'
  timeLocal: string
  daysOfWeek: string[] | null
  wakeText: string
  paused: boolean
}
const sharePeople = ref<HouseholdPerson[]>([])
const grantedIds = ref<Set<string>>(new Set())
const grantBusy = ref(false)
const schedules = ref<ScheduleRow[]>([])
const schedulesLoading = ref(false)
const schedulesError = ref('')
const createOpen = ref(false)
const detailOpen = ref(false)
const detailId = ref('')
const detailTitle = ref('')

watch(() => props.bot?.id, () => {
  syncFromBot()
  void loadGrants()
  void loadSchedules()
})

watch(open, (isOpen) => {
  if (isOpen) {
    syncFromBot()
    void loadGrants()
    void loadSchedules()
    playHeroGreet()
    return
  }
  appearanceOpen.value = false
  createOpen.value = false
  detailOpen.value = false
  clearTimeout(heroTimer)
  heroGreet.value = false
  void persistFields()
})

watch(appearanceOpen, (isOpen) => {
  if (!isOpen) {
    clearTimeout(greetTimer)
    picked.value = false
    appearanceError.value = ''
  }
})

function syncFromBot() {
  if (!props.bot) {
    return
  }
  name.value = props.bot.name
  label.value = props.bot.manifest.label
  description.value = props.bot.manifest.description
  error.value = ''
}

async function loadSchedules() {
  if (!props.bot) {
    schedules.value = []
    return
  }
  schedulesLoading.value = true
  schedulesError.value = ''
  try {
    const body = await $fetch<{ schedules: ScheduleRow[] }>(`/api/bots/${props.bot.id}/schedules`)
    schedules.value = body.schedules
  } catch {
    schedulesError.value = t('closet.openSchedulesFailed')
  } finally {
    schedulesLoading.value = false
  }
}

function openCreate() {
  createOpen.value = true
}

function openDetail(row: ScheduleRow) {
  detailId.value = row.id
  detailTitle.value = scheduleDisplayName(row)
  detailOpen.value = true
}

function onScheduleCreated() {
  createOpen.value = false
  void loadSchedules()
}

function onScheduleDeleted() {
  detailOpen.value = false
  detailId.value = ''
  void loadSchedules()
}

async function loadGrants() {
  if (!props.bot || !canEdit.value) {
    sharePeople.value = []
    grantedIds.value = new Set()
    return
  }
  try {
    const [people, grants] = await Promise.all([
      $fetch<{ people: HouseholdPerson[] }>('/api/people'),
      $fetch<{ grants: GrantRow[] }>(`/api/bots/${props.bot.id}/grants`),
    ])
    const creatorId = props.bot.createdBy
    sharePeople.value = people.people.filter((person) => person.role === 'member' && person.id !== creatorId)
    grantedIds.value = new Set(grants.grants.map((grant) => grant.personId))
  } catch {
    error.value = t('closet.openAccessFailed')
  }
}

function onGrantChange(personId: string, event: Event) {
  const checked = event.target instanceof HTMLInputElement && event.target.checked
  void toggleGrant(personId, checked)
}

async function toggleGrant(personId: string, checked: boolean) {
  if (!props.bot || grantBusy.value) {
    return
  }
  grantBusy.value = true
  error.value = ''
  try {
    if (checked) {
      await $fetch(`/api/bots/${props.bot.id}/grants`, {
        method: 'POST',
        body: { personId },
      })
    } else {
      await $fetch(`/api/bots/${props.bot.id}/grants/${personId}`, { method: 'DELETE' })
    }
    await loadGrants()
  } catch {
    error.value = t('closet.saveAccessFailed')
    await loadGrants()
  } finally {
    grantBusy.value = false
  }
}

async function grantEveryone() {
  if (!props.bot || grantBusy.value) {
    return
  }
  grantBusy.value = true
  error.value = ''
  try {
    await $fetch(`/api/bots/${props.bot.id}/grants`, {
      method: 'POST',
      body: { allCurrentMembers: true },
    })
    await loadGrants()
  } catch {
    error.value = t('closet.saveAccessFailed')
  } finally {
    grantBusy.value = false
  }
}

const SHAPE_LABELS = {
  goose: 'closetAvatar.goose',
  duck: 'closetAvatar.duck',
  swan: 'closetAvatar.swan',
  chick: 'closetAvatar.chick',
  parrot: 'closetAvatar.parrot',
  heron: 'closetAvatar.heron',
  puffin: 'closetAvatar.puffin',
  owl: 'closetAvatar.owl',
} as const

function shapeLabel(value: BotAvatarShape): string {
  return t(SHAPE_LABELS[value])
}

const heroState = computed<BotAvatarState>(() => (heroGreet.value ? 'greet' : 'idle'))

/** The chosen bird greets when you pick it; the rest hold still. */
function markState(value: BotAvatarShape): BotAvatarState {
  if (draftShape.value !== value) {
    return 'none'
  }
  return picked.value ? 'greet' : 'idle'
}

let greetTimer: ReturnType<typeof setTimeout>
let heroTimer: ReturnType<typeof setTimeout>

function playHeroGreet() {
  heroGreet.value = false
  clearTimeout(heroTimer)
  void nextTick(() => {
    heroGreet.value = true
    heroTimer = setTimeout(() => {
      heroGreet.value = false
    }, 1200)
  })
}

function playGreet() {
  picked.value = false
  clearTimeout(greetTimer)
  void nextTick(() => {
    picked.value = true
    greetTimer = setTimeout(() => {
      picked.value = false
    }, 1200)
  })
}

function openAppearance() {
  if (!canEdit.value || !props.bot) {
    return
  }
  draftShape.value = props.bot.manifest.avatarShape
  draftColor.value = props.bot.manifest.avatarColor
  appearanceError.value = ''
  appearanceOpen.value = true
  playGreet()
}

function pickShape(value: BotAvatarShape) {
  draftShape.value = value
  playGreet()
}

function pickColor(value: BotAccentHex) {
  draftColor.value = value
}

function resetAppearance() {
  draftShape.value = DEFAULT_AVATAR_SHAPE
  draftColor.value = DEFAULT_AVATAR_COLOR
  playGreet()
}

async function persistFields() {
  if (!props.bot || !canEdit.value || saving.value) {
    return
  }
  let nextName = name.value.trim()
  const nextLabel = label.value.trim()
  const nextDescription = description.value.trim()
  if (!nextName) {
    if (open.value) {
      error.value = t('closet.needName')
      return
    }
    nextName = props.bot.name
    name.value = nextName
  }
  if (
    nextName === props.bot.name
    && nextLabel === props.bot.manifest.label
    && nextDescription === props.bot.manifest.description
  ) {
    error.value = ''
    return
  }
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/bots/${props.bot.id}`, {
      method: 'PATCH',
      body: {
        name: nextName,
        label: nextLabel,
        description: nextDescription,
      },
    })
    emit('saved')
  } catch {
    error.value = t('closet.saveFailed')
  } finally {
    saving.value = false
  }
}

async function saveAppearance() {
  if (!props.bot || !canEdit.value || appearanceSaving.value) {
    return
  }
  if (
    draftShape.value === props.bot.manifest.avatarShape
    && draftColor.value === props.bot.manifest.avatarColor
  ) {
    appearanceOpen.value = false
    return
  }
  appearanceSaving.value = true
  appearanceError.value = ''
  try {
    await $fetch(`/api/bots/${props.bot.id}`, {
      method: 'PATCH',
      body: {
        avatarShape: draftShape.value,
        avatarColor: draftColor.value,
      },
    })
    emit('saved')
    appearanceOpen.value = false
  } catch {
    appearanceError.value = t('closet.saveAvatarFailed')
  } finally {
    appearanceSaving.value = false
  }
}

onUnmounted(() => {
  clearTimeout(greetTimer)
  clearTimeout(heroTimer)
})
</script>

<style scoped>
.mark {
  position: relative;
  width: 7.25rem;
  height: 7.25rem;
  margin: 0.2rem auto 1.35rem;
}

.mark :deep(.kit-bot-avatar--lg) {
  width: 7.25rem;
  height: 7.25rem;
}

.hero {
  position: absolute;
  inset: 0;
  appearance: none;
  border: 0;
  padding: 0;
  border-radius: 1.4rem;
  background: transparent;
  cursor: pointer;
}

.hero:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.pencil {
  position: absolute;
  z-index: 1;
  right: -0.15rem;
  bottom: -0.1rem;
  appearance: none;
  width: 1.7rem;
  height: 1.7rem;
  display: grid;
  place-items: center;
  border-radius: 0.55rem;
  border: 1px solid color-mix(in srgb, var(--text) 24%, transparent);
  background: var(--sheet);
  color: var(--text-muted);
  box-shadow: 0 0.12rem 0.4rem rgb(0 0 0 / 32%);
  cursor: pointer;
  padding: 0;
}

.pencil svg {
  width: 0.85rem;
  height: 0.85rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pencil:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--text) 48%, transparent);
  background: color-mix(in srgb, var(--text) 12%, transparent);
}

.pencil:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.form {
  margin: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.95rem;
  font-size: 0.92rem;
  color: var(--text-muted);
}

input,
textarea {
  appearance: none;
  width: 100%;
  border: 1px solid var(--line);
  background: var(--bg-chat);
  color: var(--text);
  border-radius: 0.9rem;
  padding: 0.8rem 0.9rem;
  font: inherit;
  font-size: 1.02rem;
  font-weight: 700;
}

textarea {
  min-height: 8.5rem;
  resize: vertical;
  line-height: 1.45;
  font-weight: 600;
}

input::placeholder,
textarea::placeholder {
  color: color-mix(in srgb, var(--text-muted) 88%, transparent);
  font-weight: 600;
}

input:focus,
textarea:focus {
  outline: 1px solid var(--accent);
}

input:disabled,
textarea:disabled {
  opacity: 1;
  cursor: default;
}

.hint {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.4;
}

.grant {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.45rem;
  color: var(--text);
  font-weight: 700;
}

.grant input {
  width: 1rem;
  height: 1rem;
  margin: 0;
  accent-color: var(--accent);
}

.grant-all {
  appearance: none;
  margin-top: 0.7rem;
  align-self: flex-start;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  border-radius: 0.8rem;
  padding: 0.45rem 0.75rem;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.grant-all:disabled {
  opacity: 0.6;
  cursor: default;
}

.grant-all:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.error {
  margin: 0 0 0.75rem;
  color: var(--accent);
  font-size: 0.88rem;
}

.editor {
  --flock-tile: 4.35rem;
  --flock-gap: 0.45rem;
  --flock-width: calc(4 * var(--flock-tile) + 3 * var(--flock-gap));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.shapes {
  display: grid;
  grid-template-columns: repeat(4, var(--flock-tile));
  gap: 0.65rem var(--flock-gap);
  width: var(--flock-width);
  margin-bottom: 0.85rem;
}

.shape {
  appearance: none;
  box-sizing: border-box;
  width: var(--flock-tile);
  height: var(--flock-tile);
  aspect-ratio: 1;
  border: 0;
  background: transparent;
  padding: 0.3rem;
  border-radius: 0.7rem;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.shape:hover:not(:disabled) {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.shape.selected {
  background: color-mix(in srgb, var(--text) 9%, transparent);
  box-shadow: inset 0 0 0 2px var(--accent);
}

.shape:disabled {
  cursor: default;
}

.shape:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.swatches {
  --swatch: 1.85rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  column-gap: calc((var(--flock-width) - 8 * var(--swatch)) / 7);
  row-gap: 0.55rem;
  width: var(--flock-width);
  padding: 0.2rem 0 0.5rem;
}

.swatch {
  appearance: none;
  flex: 0 0 var(--swatch);
  width: var(--swatch);
  height: var(--swatch);
  aspect-ratio: 1;
  border-radius: 999px;
  border: 0;
  padding: 0;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 18%);
}

.swatch.selected {
  box-shadow:
    0 0 0 2px var(--sheet),
    0 0 0 3.5px #3a3a3a;
}

.swatch:disabled {
  cursor: default;
}

.swatch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.35rem;
}

.reset {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 0.45rem 0.2rem;
}

.reset:hover:not(:disabled) {
  color: var(--text);
}

.reset:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reset:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius);
}

.schedules {
  margin: 0 0 1.15rem;
}

.schedules-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
}

.schedules-head h2 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-muted);
}

.add {
  appearance: none;
  width: 1.85rem;
  height: 1.85rem;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 0.55rem;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}

.add:hover {
  background: color-mix(in srgb, var(--text) 8%, transparent);
}

.add:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.schedules-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
}

.schedules-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 0.95rem;
  overflow: hidden;
  background: var(--bg-chat);
}

.schedules-list li + li {
  border-top: 1px solid var(--line);
}

.schedule-row {
  appearance: none;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  border: 0;
  background: transparent;
  color: var(--text);
  text-align: left;
  padding: 0.8rem 0.9rem;
  font: inherit;
  cursor: pointer;
}

.schedule-row:hover {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.schedule-row.paused {
  opacity: 0.55;
}

.schedule-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.schedule-copy {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  min-width: 0;
}

.schedule-name {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-cadence {
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 600;
}

.chevron {
  color: var(--text-muted);
  font-size: 1.25rem;
  line-height: 1;
}
</style>
