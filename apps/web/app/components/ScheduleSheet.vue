<template>
  <div class="schedule">
    <p
      v-if="gone"
      class="gone"
    >
      {{ $t('schedule.gone') }}
    </p>
    <p
      v-else-if="loadError"
      class="flash"
      role="alert"
    >
      {{ loadError }}
    </p>
    <p
      v-else-if="!creating && !schedule"
      class="muted"
    >
      {{ $t('schedule.loading') }}
    </p>
    <form
      v-else
      class="form"
      @submit.prevent="creating ? create() : persistFields()"
    >
      <label
        v-if="!creating"
        class="switch-row"
      >
        <span>{{ $t('schedule.active') }}</span>
        <input
          type="checkbox"
          role="switch"
          :checked="!paused"
          :disabled="busy"
          @change="setPaused(!paused)"
        >
      </label>

      <label class="field">
        <span>{{ $t('schedule.nameOptional') }}</span>
        <input
          v-model="name"
          type="text"
          :maxlength="SCHEDULE_NAME_MAX"
          autocomplete="off"
          :placeholder="$t('schedule.namePlaceholder')"
          :disabled="busy"
          @blur="onFieldCommit"
        >
      </label>

      <label class="field">
        <span>{{ $t('schedule.whenLabel') }}</span>
        <select
          v-model="cadence"
          :disabled="busy"
          @change="onFieldCommit"
        >
          <option value="daily">
            {{ $t('schedule.daily') }}
          </option>
          <option value="weekly">
            {{ $t('schedule.weekly') }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>{{ $t('schedule.time') }}</span>
        <input
          v-model="timeLocal"
          type="time"
          required
          :disabled="busy"
          @change="onFieldCommit"
          @blur="onFieldCommit"
        >
      </label>

      <fieldset
        v-if="cadence === 'weekly'"
        class="days"
      >
        <legend>{{ $t('schedule.daysOfWeek') }}</legend>
        <label
          v-for="day in SCHEDULE_WEEKDAYS"
          :key="day"
        >
          <input
            v-model="selectedDays"
            type="checkbox"
            :value="day"
            :disabled="busy"
            @change="onFieldCommit"
          >
          {{ weekdayLabels[day] }}
        </label>
      </fieldset>

      <label class="field">
        <span>{{ $t('schedule.instruction') }}</span>
        <textarea
          v-model="wakeText"
          rows="3"
          :maxlength="SCHEDULE_WAKE_MAX"
          required
          :placeholder="$t('schedule.wakePlaceholder')"
          :disabled="busy"
          @blur="onFieldCommit"
        />
      </label>

      <p
        v-if="!creating && nextRunLabel"
        class="meta"
      >
        <span>{{ $t('schedule.nextRun') }}</span>
        <span>{{ nextRunLabel }}</span>
      </p>

      <KitButton
        v-if="creating"
        type="submit"
        :disabled="busy || !wakeText.trim()"
      >
        {{ busy ? $t('schedule.saving') : $t('schedule.add') }}
      </KitButton>

      <section
        v-if="!creating"
        class="history"
        :aria-label="$t('schedule.history')"
      >
        <h2>{{ $t('schedule.history') }}</h2>
        <p
          v-if="runs.length === 0"
          class="muted"
        >
          {{ $t('schedule.noRunsYet') }}
        </p>
        <ul
          v-else
          class="runs"
        >
          <li
            v-for="run in runs"
            :key="run.id"
          >
            <span>{{ scheduleWhenLabel(run.startedAt, timeZone, Date.now(), hostLocale) }}</span>
            <span :class="{ ok: run.outcome === 'ok', bad: run.outcome === 'error' || run.outcome === 'abort' }">
              {{ scheduleRunOutcome(run.outcome, hostLocale) }}
            </span>
          </li>
        </ul>
      </section>

      <div
        v-if="!creating && !confirming"
        class="danger-wrap"
      >
        <button
          type="button"
          class="danger"
          :disabled="busy"
          @click="confirming = true"
        >
          {{ $t('schedule.delete') }}
        </button>
      </div>
      <div
        v-else-if="!creating"
        class="confirm"
      >
        <p>{{ $t('schedule.confirmDelete') }}</p>
        <div class="actions">
          <button
            type="button"
            class="danger"
            :disabled="busy"
            @click="remove"
          >
            {{ $t('schedule.delete') }}
          </button>
          <button
            type="button"
            class="ghost"
            :disabled="busy"
            @click="confirming = false"
          >
            {{ $t('common.cancel') }}
          </button>
        </div>
      </div>

      <p
        v-if="saveError"
        class="flash"
        role="alert"
      >
        {{ saveError }}
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { KitButton } from '@dostigus/ui-kit'
import {
  SCHEDULE_NAME_MAX,
  SCHEDULE_WAKE_MAX,
  SCHEDULE_WEEKDAYS,
  scheduleDisplayName,
  scheduleRunOutcome,
  scheduleWeekdayLabels,
  scheduleWhenLabel,
} from '../utils/schedule-copy'

type ScheduleCadence = 'daily' | 'weekly'

type ScheduleView = {
  id: string
  name: string
  cadence: ScheduleCadence
  timeLocal: string
  daysOfWeek: string[] | null
  wakeText: string
  paused: boolean
  nextRunAt?: string
}

type ScheduleRun = {
  id: string
  startedAt: string
  outcome: string
}

const props = withDefaults(defineProps<{
  scheduleId?: string
  botId?: string
  mode?: 'detail' | 'create'
}>(), {
  scheduleId: '',
  botId: '',
  mode: 'detail',
})

const emit = defineEmits<{
  created: [id: string]
  saved: []
  deleted: []
  titled: [title: string]
}>()

const creating = computed(() => props.mode === 'create')
const { locale, t } = useI18n()
const hostLocale = computed(() => locale.value === 'ru' ? 'ru' as const : 'en' as const)
const weekdayLabels = computed(() => scheduleWeekdayLabels(hostLocale.value))

const schedule = ref<ScheduleView | null>(null)
const name = ref('')
const cadence = ref<ScheduleCadence>('daily')
const timeLocal = ref('08:00')
const selectedDays = ref<string[]>([])
const wakeText = ref('')
const paused = ref(false)
const nextRunAt = ref('')
const timeZone = ref('UTC')
const runs = ref<ScheduleRun[]>([])
const gone = ref(false)
const loadError = ref('')
const saveError = ref('')
const busy = ref(false)
const confirming = ref(false)

const nextRunLabel = computed(() => {
  if (paused.value || !nextRunAt.value) {
    return ''
  }
  return scheduleWhenLabel(nextRunAt.value, timeZone.value, Date.now(), hostLocale.value)
})

watch(() => [props.scheduleId, props.mode, props.botId] as const, () => {
  void load()
}, { immediate: true })

function resetDraft() {
  name.value = ''
  cadence.value = 'daily'
  timeLocal.value = '08:00'
  selectedDays.value = []
  wakeText.value = ''
  paused.value = false
  nextRunAt.value = ''
  runs.value = []
  confirming.value = false
}

function apply(next: ScheduleView) {
  schedule.value = next
  name.value = next.name
  cadence.value = next.cadence
  timeLocal.value = next.timeLocal
  selectedDays.value = [...(next.daysOfWeek ?? [])]
  wakeText.value = next.wakeText
  paused.value = next.paused
  nextRunAt.value = next.nextRunAt ?? ''
  gone.value = false
  emit('titled', scheduleDisplayName(next))
}

async function load() {
  gone.value = false
  loadError.value = ''
  saveError.value = ''
  confirming.value = false
  if (creating.value) {
    schedule.value = {
      id: '',
      name: '',
      cadence: 'daily',
      timeLocal: '08:00',
      daysOfWeek: null,
      wakeText: '',
      paused: false,
    }
    resetDraft()
    emit('titled', t('closet.newSchedule'))
    return
  }
  schedule.value = null
  runs.value = []
  if (!props.scheduleId) {
    gone.value = true
    return
  }
  try {
    const body = await $fetch<{
      schedule: ScheduleView
      timeZone?: string
      runs?: ScheduleRun[]
    }>(`/api/schedules/${props.scheduleId}`)
    timeZone.value = body.timeZone ?? 'UTC'
    runs.value = body.runs ?? []
    apply(body.schedule)
  } catch (error) {
    if (statusOf(error) === 404) {
      gone.value = true
      emit('titled', t('closet.scheduleTitle'))
      return
    }
    loadError.value = messageOf(error)
  }
}

function onFieldCommit() {
  if (!creating.value) {
    void persistFields()
  }
}

function writeBody() {
  return {
    name: name.value,
    cadence: cadence.value,
    timeLocal: timeLocal.value,
    wakeText: wakeText.value,
    daysOfWeek: cadence.value === 'weekly' ? selectedDays.value : undefined,
  }
}

function dirty(): boolean {
  if (!schedule.value) {
    return false
  }
  const days = cadence.value === 'weekly' ? [...selectedDays.value].sort().join(',') : ''
  const was = schedule.value.cadence === 'weekly'
    ? [...(schedule.value.daysOfWeek ?? [])].sort().join(',')
    : ''
  return name.value.trim() !== schedule.value.name
    || cadence.value !== schedule.value.cadence
    || timeLocal.value !== schedule.value.timeLocal
    || wakeText.value.trim() !== schedule.value.wakeText
    || days !== was
}

async function persistFields() {
  if (creating.value || !schedule.value || busy.value || !dirty()) {
    return
  }
  if (cadence.value === 'weekly' && selectedDays.value.length === 0) {
    saveError.value = t('schedule.needDays')
    return
  }
  if (!wakeText.value.trim()) {
    saveError.value = t('schedule.needInstruction')
    return
  }
  busy.value = true
  saveError.value = ''
  try {
    const body = await $fetch<{ schedule: ScheduleView }>(`/api/schedules/${schedule.value.id}`, {
      method: 'PATCH',
      body: writeBody(),
    })
    apply(body.schedule)
    emit('saved')
  } catch (error) {
    saveError.value = messageOf(error)
  } finally {
    busy.value = false
  }
}

async function create() {
  if (!creating.value || !props.botId || busy.value) {
    return
  }
  if (cadence.value === 'weekly' && selectedDays.value.length === 0) {
    saveError.value = t('schedule.needDays')
    return
  }
  if (!wakeText.value.trim()) {
    saveError.value = t('schedule.needInstruction')
    return
  }
  busy.value = true
  saveError.value = ''
  try {
    const body = await $fetch<{ schedule: ScheduleView }>(`/api/bots/${props.botId}/schedules`, {
      method: 'POST',
      body: writeBody(),
    })
    emit('created', body.schedule.id)
  } catch (error) {
    saveError.value = messageOf(error)
  } finally {
    busy.value = false
  }
}

async function setPaused(nextPaused: boolean) {
  if (creating.value || !schedule.value || busy.value) {
    return
  }
  busy.value = true
  saveError.value = ''
  try {
    const body = await $fetch<{ schedule: ScheduleView }>(`/api/schedules/${schedule.value.id}`, {
      method: 'PATCH',
      body: { paused: nextPaused },
    })
    apply(body.schedule)
    emit('saved')
  } catch (error) {
    saveError.value = messageOf(error)
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (creating.value || !schedule.value || busy.value) {
    return
  }
  busy.value = true
  saveError.value = ''
  try {
    await $fetch(`/api/schedules/${schedule.value.id}`, { method: 'DELETE' })
    schedule.value = null
    gone.value = true
    confirming.value = false
    emit('deleted')
  } catch (error) {
    saveError.value = messageOf(error)
  } finally {
    busy.value = false
  }
}

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = (error as { statusCode?: number }).statusCode
    return typeof code === 'number' ? code : undefined
  }
  return undefined
}

function messageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    const status = (error as { statusMessage?: string }).statusMessage
    if (status?.trim()) {
      return status
    }
  }
  return creating.value ? t('schedule.createFailed') : t('schedule.saveFailed')
}
</script>

<style scoped>
.schedule {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.form,
.field,
.actions,
.days {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field {
  margin: 0;
  font-size: 0.88rem;
  color: var(--text-muted);
}

input,
textarea,
select {
  appearance: none;
  width: 100%;
  border: 1px solid var(--line);
  background: var(--bg-chat);
  color: var(--text);
  border-radius: 0.9rem;
  padding: 0.75rem 0.9rem;
  font: inherit;
  font-size: 1.02rem;
  font-weight: 700;
}

textarea {
  min-height: 6rem;
  resize: vertical;
  line-height: 1.45;
  font-weight: 600;
}

select {
  cursor: pointer;
}

input:focus,
textarea:focus,
select:focus {
  outline: 1px solid var(--accent);
}

.days {
  border: 0;
  margin: 0;
  padding: 0;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.days legend {
  padding: 0;
  margin-bottom: 0.35rem;
}

.days label {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  color: var(--text);
  font-weight: 700;
}

.days input {
  width: 1rem;
  height: 1rem;
  margin: 0;
  padding: 0;
  accent-color: var(--accent);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--line);
  background: var(--bg-chat);
  border-radius: 0.9rem;
  padding: 0.8rem 0.95rem;
  color: var(--text);
  font-weight: 700;
}

.switch-row input {
  width: 2.7rem;
  height: 1.6rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 22%, transparent);
  cursor: pointer;
  position: relative;
}

.switch-row input:checked {
  background: #34c759;
}

.switch-row input::after {
  content: '';
  position: absolute;
  top: 0.16rem;
  left: 0.16rem;
  width: 1.28rem;
  height: 1.28rem;
  border-radius: 999px;
  background: #fff;
  transition: transform 0.16s ease;
}

.switch-row input:checked::after {
  transform: translateX(1.1rem);
}

.meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  padding: 0.75rem 0.2rem 0;
  color: var(--text-muted);
  font-size: 0.88rem;
  font-weight: 600;
}

.meta span:last-child {
  color: var(--text);
  text-align: right;
}

.history {
  margin-top: 0.4rem;
}

.history h2 {
  margin: 0 0 0.55rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-muted);
}

.runs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.runs li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-weight: 600;
}

.runs .ok {
  color: #2f9e5f;
}

.runs .bad {
  color: var(--accent);
}

.danger-wrap,
.confirm {
  margin-top: 0.55rem;
}

.danger,
.ghost {
  appearance: none;
  border: 0;
  background: transparent;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  padding: 0.45rem 0;
}

.danger {
  color: #e24b4b;
}

.ghost {
  color: var(--text-muted);
}

.actions {
  flex-direction: row;
  gap: 1rem;
}

.paused,
.muted,
.gone {
  margin: 0;
}

.flash {
  margin: 0;
  color: var(--accent);
}

.gone,
.muted {
  color: var(--text-muted);
}
</style>
