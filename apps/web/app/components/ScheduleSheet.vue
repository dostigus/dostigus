<template>
  <div class="schedule">
    <p
      v-if="gone"
      class="muted"
    >
      {{ $t('schedule.gone') }}
    </p>
    <p
      v-else-if="loadError"
      class="error"
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
      <KitToggle
        v-if="!creating"
        class="switch-row"
        :label="$t('schedule.active')"
        :model-value="!paused"
        :disabled="busy"
        @update:model-value="(active) => setPaused(!active)"
      />

      <KitField
        :label="$t('schedule.nameOptional')"
        :error="errors.name"
      >
        <KitInput
          v-model="name"
          name="name"
          :maxlength="SCHEDULE_NAME_MAX"
          autocomplete="off"
          :placeholder="$t('schedule.namePlaceholder')"
          :readonly="busy"
          @blur="onFieldCommit"
        />
      </KitField>

      <KitField
        :label="$t('schedule.whenLabel')"
        :error="errors.cadence"
      >
        <KitSelect
          :model-value="cadence"
          name="cadence"
          :options="cadenceOptions"
          :disabled="busy"
          @update:model-value="pickCadence"
        />
      </KitField>

      <KitField
        :label="$t('schedule.time')"
        :error="errors.time"
        required
      >
        <KitInput
          v-model="timeLocal"
          name="timeLocal"
          type="time"
          :readonly="busy"
          @change="onFieldCommit"
          @blur="onFieldCommit"
        />
      </KitField>

      <KitField
        v-if="cadence === 'weekly'"
        :label="$t('schedule.daysOfWeek')"
        :error="errors.days"
      >
        <div
          class="days"
          role="group"
          :aria-label="$t('schedule.daysOfWeek')"
        >
          <KitChip
            v-for="day in SCHEDULE_WEEKDAYS"
            :key="day"
            as="button"
            :selected="selectedDays.includes(day)"
            :disabled="busy"
            @click="toggleDay(day)"
          >
            {{ weekdayLabels[day] }}
          </KitChip>
        </div>
      </KitField>

      <KitField
        :label="$t('schedule.instruction')"
        :error="errors.wakeText"
        required
      >
        <KitTextarea
          v-model="wakeText"
          name="wakeText"
          :rows="3"
          :maxlength="SCHEDULE_WAKE_MAX"
          :placeholder="$t('schedule.wakePlaceholder')"
          :readonly="busy"
          @blur="onFieldCommit"
        />
      </KitField>

      <p
        v-if="!creating && nextRunLabel"
        class="meta"
      >
        <span>{{ $t('schedule.nextRun') }}</span>
        <span>{{ nextRunLabel }}</span>
      </p>

      <p
        v-if="errors.form"
        class="error"
        role="alert"
      >
        {{ errors.form }}
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
        aria-labelledby="schedule-history-heading"
      >
        <h2 id="schedule-history-heading">
          {{ $t('schedule.history') }}
        </h2>
        <p
          v-if="runs.length === 0"
          class="muted"
        >
          {{ $t('schedule.noRunsYet') }}
        </p>
        <ul
          v-else
          class="rows"
        >
          <KitListRow
            v-for="run in runs"
            :key="run.id"
            as="li"
            :title="scheduleWhenLabel(run.startedAt, timeZone, Date.now(), hostLocale)"
          >
            <template #trailing>
              <KitChip :tone="runTone(run.outcome)">
                {{ scheduleRunOutcome(run.outcome, hostLocale) }}
              </KitChip>
            </template>
          </KitListRow>
        </ul>
      </section>

      <div
        v-if="!creating && !confirming"
        class="actions"
      >
        <KitButton
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="confirming = true"
        >
          {{ $t('schedule.delete') }}
        </KitButton>
      </div>
      <div
        v-else-if="!creating"
        class="confirm"
      >
        <p>{{ $t('schedule.confirmDelete') }}</p>
        <div class="actions">
          <KitButton
            variant="ghost"
            size="sm"
            :disabled="busy"
            @click="confirming = false"
          >
            {{ $t('common.cancel') }}
          </KitButton>
          <KitButton
            size="sm"
            :disabled="busy"
            @click="remove"
          >
            {{ $t('schedule.delete') }}
          </KitButton>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { KitSelectOption } from '@dostigus/ui-kit'
import type { ScheduleFormField } from '../utils/schedule-form'
import { KitButton, KitChip, KitField, KitInput, KitListRow, KitSelect, KitTextarea, KitToggle } from '@dostigus/ui-kit'
import {
  SCHEDULE_NAME_MAX,
  SCHEDULE_WAKE_MAX,
  SCHEDULE_WEEKDAYS,
  scheduleDisplayName,
  scheduleRunOutcome,
  scheduleWeekdayLabels,
  scheduleWhenLabel,
} from '../utils/schedule-copy'
import { scheduleErrorField } from '../utils/schedule-form'

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
const cadenceOptions = computed<KitSelectOption[]>(() => [
  { value: 'daily', label: t('schedule.daily') },
  { value: 'weekly', label: t('schedule.weekly') },
])

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
const errors = ref<Partial<Record<ScheduleFormField, string>>>({})
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
  errors.value = {}
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

function pickCadence(value: string | undefined) {
  if (value !== 'daily' && value !== 'weekly') {
    return
  }
  cadence.value = value
  onFieldCommit()
}

function toggleDay(day: string) {
  selectedDays.value = selectedDays.value.includes(day)
    ? selectedDays.value.filter((item) => item !== day)
    : [...selectedDays.value, day]
  onFieldCommit()
}

function runTone(outcome: string): 'ok' | 'warn' | 'neutral' {
  if (outcome === 'ok') {
    return 'ok'
  }
  return outcome === 'error' || outcome === 'abort' ? 'warn' : 'neutral'
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
  if (creating.value || !schedule.value || busy.value) {
    return
  }
  if (!dirty()) {
    errors.value = {}
    return
  }
  if (cadence.value === 'weekly' && selectedDays.value.length === 0) {
    errors.value = { days: t('schedule.needDays') }
    return
  }
  if (!wakeText.value.trim()) {
    errors.value = { wakeText: t('schedule.needInstruction') }
    return
  }
  busy.value = true
  errors.value = {}
  try {
    const body = await $fetch<{ schedule: ScheduleView }>(`/api/schedules/${schedule.value.id}`, {
      method: 'PATCH',
      body: writeBody(),
    })
    apply(body.schedule)
    emit('saved')
  } catch (error) {
    errors.value = { [scheduleErrorField(error)]: messageOf(error) }
  } finally {
    busy.value = false
  }
}

async function create() {
  if (!creating.value || !props.botId || busy.value) {
    return
  }
  if (cadence.value === 'weekly' && selectedDays.value.length === 0) {
    errors.value = { days: t('schedule.needDays') }
    return
  }
  if (!wakeText.value.trim()) {
    errors.value = { wakeText: t('schedule.needInstruction') }
    return
  }
  busy.value = true
  errors.value = {}
  try {
    const body = await $fetch<{ schedule: ScheduleView }>(`/api/bots/${props.botId}/schedules`, {
      method: 'POST',
      body: writeBody(),
    })
    emit('created', body.schedule.id)
  } catch (error) {
    errors.value = { [scheduleErrorField(error)]: messageOf(error) }
  } finally {
    busy.value = false
  }
}

async function setPaused(nextPaused: boolean) {
  if (creating.value || !schedule.value || busy.value) {
    return
  }
  busy.value = true
  errors.value = {}
  try {
    const body = await $fetch<{ schedule: ScheduleView }>(`/api/schedules/${schedule.value.id}`, {
      method: 'PATCH',
      body: { paused: nextPaused },
    })
    apply(body.schedule)
    emit('saved')
  } catch (error) {
    errors.value = { form: messageOf(error) }
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (creating.value || !schedule.value || busy.value) {
    return
  }
  busy.value = true
  errors.value = {}
  try {
    await $fetch(`/api/schedules/${schedule.value.id}`, { method: 'DELETE' })
    schedule.value = null
    gone.value = true
    confirming.value = false
    emit('deleted')
  } catch (error) {
    errors.value = { form: messageOf(error) }
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
.schedule,
.form {
  display: flex;
  flex-direction: column;
}

.schedule {
  gap: 0.85rem;
}

.form {
  gap: 0.9rem;
}

.switch-row {
  border: 1px solid var(--line);
  background: var(--bg);
  border-radius: var(--radius);
  padding: 0.75rem 0.9rem;
  font-weight: 700;
}

.days {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  padding: 0 0.2rem;
  color: var(--text-muted);
  font-size: 0.88rem;
  font-weight: 600;
}

.meta span:last-child {
  color: var(--text);
  text-align: right;
}

.history h2 {
  margin: 0 0 0.35rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-muted);
}

.rows {
  list-style: none;
  margin: 0 -0.7rem;
  padding: 0;
}

.rows > li + li {
  border-top: 1px solid var(--line);
}

.confirm p {
  margin: 0 0 0.55rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.error,
.muted {
  margin: 0;
}

.error {
  color: var(--accent);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.45;
}

.muted {
  color: var(--text-muted);
}
</style>
