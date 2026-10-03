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
      <KitField
        :label="$t('closet.name')"
        :error="nameError || undefined"
        required
      >
        <KitInput
          v-model="name"
          maxlength="120"
          autocomplete="off"
          :readonly="!canEdit || saving"
          @blur="persistFields"
        />
      </KitField>
      <KitField :label="$t('closet.labelOptional')">
        <KitInput
          v-model="label"
          maxlength="160"
          autocomplete="off"
          :placeholder="$t('closet.labelPlaceholder')"
          :readonly="!canEdit || saving"
          @blur="persistFields"
        />
      </KitField>
      <KitField :label="$t('closet.description')">
        <KitTextarea
          v-model="description"
          maxlength="2000"
          :rows="5"
          :placeholder="$t('closet.descriptionPlaceholder')"
          :readonly="!canEdit || saving"
          @blur="persistFields"
        />
      </KitField>
      <p
        v-if="error"
        class="note"
        role="alert"
      >
        <KitChip tone="warn">
          {{ error }}
        </KitChip>
      </p>
      <section
        class="group"
        aria-labelledby="schedules-heading"
      >
        <div class="group-head">
          <h2 id="schedules-heading">
            {{ $t('closet.schedules') }}
          </h2>
          <KitButton
            variant="ghost"
            size="sm"
            :aria-label="$t('closet.addSchedule')"
            @click="openCreate"
          >
            {{ $t('closet.add') }}
          </KitButton>
        </div>
        <p
          v-if="schedulesError"
          class="note"
          role="alert"
        >
          <KitChip tone="warn">
            {{ schedulesError }}
          </KitChip>
        </p>
        <p
          v-else-if="schedulesLoading"
          class="hint"
        >
          {{ $t('closet.loading') }}
        </p>
        <p
          v-else-if="schedules.length === 0"
          class="hint"
        >
          {{ $t('closet.noSchedules') }}
        </p>
        <ul
          v-else
          class="rows"
        >
          <li
            v-for="row in schedules"
            :key="row.id"
          >
            <KitListRow
              as="button"
              class="schedule-row"
              :title="scheduleDisplayName(row)"
              :subtitle="scheduleCadenceLabel(row, hostLocale)"
              @click="openDetail(row)"
            >
              <template #trailing>
                <KitChip v-if="row.paused">
                  {{ $t('schedule.paused') }}
                </KitChip>
                <span
                  class="chevron"
                  aria-hidden="true"
                >›</span>
              </template>
            </KitListRow>
          </li>
        </ul>
      </section>
      <section
        v-if="showMailbox"
        class="group"
        aria-labelledby="mailbox-heading"
      >
        <h2 id="mailbox-heading">
          {{ $t('mailbox.title') }}
        </h2>
        <ul class="rows">
          <li>
            <KitListRow
              as="button"
              class="mailbox-row"
              :title="mailState.binding ? mailState.binding.imap.user : $t('mailbox.notConnected')"
              :subtitle="mailState.binding ? `${mailState.binding.imap.host}:${mailState.binding.imap.port}` : undefined"
              @click="mailboxOpen = true"
            >
              <template #trailing>
                <span
                  class="chevron"
                  aria-hidden="true"
                >›</span>
              </template>
            </KitListRow>
          </li>
        </ul>
      </section>
      <PackClosetActions
        v-if="bot"
        :bot-id="bot.id"
        :can-update="canEdit"
        @applied="onPackApplied"
      />
      <section
        v-if="canShare"
        class="group"
        aria-labelledby="who-sees-heading"
      >
        <h2 id="who-sees-heading">
          {{ $t('closet.whoSees') }}
        </h2>
        <p class="hint">
          {{ $t('closet.whoSeesHint') }}
        </p>
        <p
          v-if="sharePeople.length === 0"
          class="hint"
        >
          {{ $t('closet.noOtherMembers') }}
        </p>
        <KitToggle
          v-for="person in sharePeople"
          :key="person.id"
          :label="person.displayName"
          :model-value="grantedIds.has(person.id)"
          :disabled="grantBusy"
          @update:model-value="(granted) => toggleGrant(person.id, granted)"
        />
        <p
          v-if="grantError"
          class="note"
          role="alert"
        >
          <KitChip tone="warn">
            {{ grantError }}
          </KitChip>
        </p>
        <div
          v-if="sharePeople.length > 0"
          class="group-actions"
        >
          <KitButton
            variant="ghost"
            size="sm"
            :disabled="grantBusy"
            @click="grantEveryone"
          >
            {{ $t('closet.grantAll') }}
          </KitButton>
        </div>
      </section>
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
        class="note"
        role="alert"
      >
        <KitChip tone="warn">
          {{ appearanceError }}
        </KitChip>
      </p>

      <div class="actions">
        <KitButton
          variant="ghost"
          :disabled="appearanceSaving"
          @click="resetAppearance"
        >
          {{ $t('closet.reset') }}
        </KitButton>
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
    v-model:open="mailboxOpen"
    edge="end"
    :title="$t('mailbox.title')"
    title-align="center"
    close="icon"
  >
    <MailBindingSheet
      v-if="bot && mailboxOpen"
      :bot-id="bot.id"
      @changed="mailState = $event"
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
  isMailerPackSnapshot,
} from '@dostigus/shared'
import {
  KitBotAvatar,
  KitButton,
  KitChip,
  KitDialog,
  KitField,
  KitInput,
  KitListRow,
  KitSheet,
  KitTextarea,
  KitToggle,
} from '@dostigus/ui-kit'
import { scheduleCadenceLabel, scheduleDisplayName } from '../utils/schedule-copy'

const props = defineProps<{
  bot: Bot | undefined
}>()

const emit = defineEmits<{
  saved: []
  applied: [botId: string]
}>()

const { locale, t } = useI18n()
const hostLocale = computed(() => locale.value === 'ru' ? 'ru' as const : 'en' as const)

const open = defineModel<boolean>('open', { required: true })

const { user, isOwner, isAdmin } = useHostAccount()
const canEdit = computed(() => {
  if (!props.bot || !user.value?.id) {
    return false
  }
  return canEditBot(props.bot, {
    id: user.value.id,
    role: isOwner.value ? 'owner' : 'member',
  })
})
const canShare = computed(() => canEdit.value || isAdmin.value)
/** Bot mail binding is Owner / Admin in the Closet after Apply. See ADR 0048. */
const canBindMail = computed(() => isOwner.value || isAdmin.value)
type MailState = {
  binding: { imap: { host: string, port: number, user: string } } | null
}
const mailState = ref<MailState>({ binding: null })
const mailboxOpen = ref(false)
const showMailbox = computed(() => Boolean(props.bot && canBindMail.value
  && (isMailerPackSnapshot(props.bot.installedPackId) || mailState.value.binding)))
const shapes = BOT_AVATAR_SHAPES
const accents = BOT_ACCENT_TOKENS
const name = ref('')
const label = ref('')
const description = ref('')
const saving = ref(false)
const error = ref('')
const nameError = ref('')
const grantError = ref('')
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
  void loadMailbox()
})

watch(open, (isOpen) => {
  if (isOpen) {
    syncFromBot()
    void loadGrants()
    void loadSchedules()
    void loadMailbox()
    playHeroGreet()
    return
  }
  appearanceOpen.value = false
  createOpen.value = false
  mailboxOpen.value = false
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
  nameError.value = ''
  grantError.value = ''
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

async function loadMailbox() {
  if (!props.bot || !canBindMail.value) {
    mailState.value = { binding: null }
    return
  }
  try {
    mailState.value = await $fetch<MailState>(`/api/bots/${props.bot.id}/mail`)
  } catch {
    mailState.value = { binding: null }
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

function onPackApplied(botId: string) {
  emit('applied', botId)
  emit('saved')
  void loadSchedules()
  void loadMailbox()
}

async function loadGrants() {
  if (!props.bot || !canShare.value) {
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
    sharePeople.value = people.people.filter((person) => {
      return person.role === 'member' && person.id !== creatorId && person.id !== user.value?.id
    })
    grantedIds.value = new Set(grants.grants.map((grant) => grant.personId))
  } catch {
    grantError.value = t('closet.openAccessFailed')
  }
}

async function toggleGrant(personId: string, checked: boolean) {
  if (!props.bot || grantBusy.value) {
    return
  }
  grantBusy.value = true
  grantError.value = ''
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
    grantError.value = t('closet.saveAccessFailed')
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
  grantError.value = ''
  try {
    await $fetch(`/api/bots/${props.bot.id}/grants`, {
      method: 'POST',
      body: { allCurrentMembers: true },
    })
    await loadGrants()
  } catch {
    grantError.value = t('closet.saveAccessFailed')
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
      nameError.value = t('closet.needName')
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
    nameError.value = ''
    return
  }
  saving.value = true
  error.value = ''
  nameError.value = ''
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
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  margin: 0;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--line);
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.group h2 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-muted);
}

.hint,
.note {
  margin: 0;
}

.hint {
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.group-actions {
  display: flex;
}

.rows {
  list-style: none;
  margin: 0 -0.7rem;
  padding: 0;
}

.rows > li + li {
  border-top: 1px solid var(--line);
}

.chevron {
  font-size: 1.25rem;
  line-height: 1;
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
    0 0 0 3.5px var(--text-muted);
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
</style>
