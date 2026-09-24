<template>
  <div class="schedule">
    <p
      v-if="gone"
      class="gone"
    >
      This Schedule is gone.
    </p>
    <p
      v-else-if="loadError"
      class="flash"
      role="alert"
    >
      {{ loadError }}
    </p>
    <p
      v-else-if="!schedule"
      class="muted"
    >
      Loading…
    </p>
    <form
      v-else
      class="form"
      @submit.prevent="save"
    >
      <p class="paused">
        {{ schedule.paused ? 'Paused' : 'Enabled' }}
      </p>
      <label class="field">
        <span>Cadence</span>
        <select
          v-model="cadence"
          :disabled="busy"
        >
          <option value="daily">
            daily
          </option>
          <option value="weekly">
            weekly
          </option>
        </select>
      </label>
      <label class="field">
        <span>Time</span>
        <input
          v-model="timeLocal"
          type="time"
          required
          :disabled="busy"
        >
      </label>
      <fieldset
        v-if="cadence === 'weekly'"
        class="days"
      >
        <legend>Weekdays</legend>
        <label
          v-for="day in weekdays"
          :key="day"
        >
          <input
            v-model="selectedDays"
            type="checkbox"
            :value="day"
            :disabled="busy"
          >
          {{ day }}
        </label>
      </fieldset>
      <label class="field">
        <span>Wake</span>
        <textarea
          v-model="wakeText"
          rows="3"
          maxlength="2000"
          required
          :disabled="busy"
        />
      </label>
      <div
        v-if="!confirming"
        class="actions"
      >
        <KitButton
          type="button"
          :disabled="busy"
          @click="setPaused(!schedule.paused)"
        >
          {{ schedule.paused ? 'Resume' : 'Pause' }}
        </KitButton>
        <KitButton
          type="submit"
          :disabled="busy"
        >
          Save
        </KitButton>
        <KitButton
          type="button"
          :disabled="busy"
          @click="confirming = true"
        >
          Delete
        </KitButton>
      </div>
      <div
        v-else
        class="confirm"
      >
        <p>Delete this Schedule?</p>
        <div class="actions">
          <KitButton
            type="button"
            :disabled="busy"
            @click="remove"
          >
            Delete
          </KitButton>
          <KitButton
            type="button"
            :disabled="busy"
            @click="confirming = false"
          >
            Cancel
          </KitButton>
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

type ScheduleCadence = 'daily' | 'weekly'

type ScheduleView = {
  id: string
  cadence: ScheduleCadence
  timeLocal: string
  daysOfWeek: string[] | null
  wakeText: string
  paused: boolean
}

const props = defineProps<{
  scheduleId: string
}>()

const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const schedule = ref<ScheduleView | null>(null)
const cadence = ref<ScheduleCadence>('daily')
const timeLocal = ref('08:00')
const selectedDays = ref<string[]>([])
const wakeText = ref('')
const gone = ref(false)
const loadError = ref('')
const saveError = ref('')
const busy = ref(false)
const confirming = ref(false)

watch(() => props.scheduleId, () => {
  void load()
}, { immediate: true })

function apply(next: ScheduleView) {
  schedule.value = next
  cadence.value = next.cadence
  timeLocal.value = next.timeLocal
  selectedDays.value = [...(next.daysOfWeek ?? [])]
  wakeText.value = next.wakeText
  gone.value = false
}

async function load() {
  gone.value = false
  loadError.value = ''
  saveError.value = ''
  confirming.value = false
  schedule.value = null
  if (!props.scheduleId) {
    gone.value = true
    return
  }
  try {
    const body = await $fetch<{ schedule: ScheduleView }>(`/api/schedules/${props.scheduleId}`)
    apply(body.schedule)
  } catch (error) {
    if (statusOf(error) === 404) {
      gone.value = true
      return
    }
    loadError.value = messageOf(error)
  }
}

async function save() {
  if (!schedule.value || busy.value) {
    return
  }
  busy.value = true
  saveError.value = ''
  try {
    const body = await $fetch<{ schedule: ScheduleView }>(`/api/schedules/${schedule.value.id}`, {
      method: 'PATCH',
      body: {
        cadence: cadence.value,
        timeLocal: timeLocal.value,
        wakeText: wakeText.value,
        daysOfWeek: cadence.value === 'weekly' ? selectedDays.value : undefined,
      },
    })
    apply(body.schedule)
  } catch (error) {
    saveError.value = messageOf(error)
  } finally {
    busy.value = false
  }
}

async function setPaused(paused: boolean) {
  if (!schedule.value || busy.value) {
    return
  }
  busy.value = true
  saveError.value = ''
  try {
    const body = await $fetch<{ schedule: ScheduleView }>(`/api/schedules/${schedule.value.id}`, {
      method: 'PATCH',
      body: { paused },
    })
    apply(body.schedule)
  } catch (error) {
    saveError.value = messageOf(error)
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (!schedule.value || busy.value) {
    return
  }
  busy.value = true
  saveError.value = ''
  try {
    await $fetch(`/api/schedules/${schedule.value.id}`, { method: 'DELETE' })
    schedule.value = null
    gone.value = true
    confirming.value = false
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
  return 'Schedule could not save'
}
</script>

<style scoped>
.schedule {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form,
.field,
.actions,
.days {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.days {
  border: 0;
  margin: 0;
  padding: 0;
}

.days label {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.actions {
  flex-direction: row;
  flex-wrap: wrap;
}

.paused,
.muted,
.gone {
  margin: 0;
}

.flash {
  margin: 0;
  color: var(--accent, #f25630);
}
</style>
