<template>
  <section
    class="case"
    aria-labelledby="case-heading"
  >
    <div class="head">
      <h2 id="case-heading">
        {{ $t('host.threadCase.heading') }}
      </h2>
      <KitChip
        v-if="current && !editing"
        :tone="current.status === 'done' ? 'ok' : 'neutral'"
      >
        {{ statusText(current.status) }}
      </KitChip>
    </div>

    <KitListRow
      v-if="!current && !editing"
      as="button"
      class="add-case"
      :subtitle="$t('host.threadCase.addHint')"
      @click="startEdit"
    >
      <template #leading>
        <span
          class="plus"
          aria-hidden="true"
        />
      </template>
      <template #title>
        {{ $t('host.threadCase.add') }}
      </template>
    </KitListRow>

    <div
      v-else-if="current && !editing"
      class="view"
    >
      <template v-if="current.label || current.nextAction">
        <p
          v-if="current.label"
          class="label"
        >
          {{ current.label }}
        </p>
        <p
          v-if="current.nextAction"
          class="next"
        >
          <span class="next-key">{{ $t('host.threadCase.nextAction') }}</span>
          {{ current.nextAction }}
        </p>
      </template>
      <p
        v-else
        class="hint"
      >
        {{ $t('host.threadCase.noText') }}
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
      <div class="actions">
        <KitButton
          size="sm"
          :disabled="busy"
          @click="flip"
        >
          {{ busy ? $t('common.saving') : current.status === 'done' ? $t('host.threadCase.reopen') : $t('host.threadCase.markDone') }}
        </KitButton>
        <KitButton
          size="sm"
          variant="ghost"
          :disabled="busy"
          @click="startEdit"
        >
          {{ $t('host.threadCase.edit') }}
        </KitButton>
      </div>

      <div
        v-if="current.status === 'open'"
        class="follow"
      >
        <p class="next-key">
          {{ $t('host.threadCase.followUp') }}
        </p>
        <template v-if="!followEditing">
          <p
            v-if="current.followUpAt"
            class="follow-when"
          >
            {{ followUpSummary }}
          </p>
          <p
            v-else-if="botOptions.length === 0"
            class="hint"
          >
            {{ $t('host.threadCase.followUpNoBots') }}
          </p>
          <div
            v-if="botOptions.length > 0 || current.followUpAt"
            class="actions"
          >
            <KitButton
              v-if="botOptions.length > 0"
              size="sm"
              variant="ghost"
              :disabled="busy"
              @click="startFollowUp"
            >
              {{ current.followUpAt ? $t('host.threadCase.followUpChange') : $t('host.threadCase.followUpAdd') }}
            </KitButton>
            <KitButton
              v-if="current.followUpAt"
              size="sm"
              variant="ghost"
              :disabled="busy"
              @click="clearFollowUp"
            >
              {{ $t('host.threadCase.followUpClear') }}
            </KitButton>
          </div>
        </template>
        <form
          v-else
          class="edit"
          @submit.prevent="saveFollowUp"
        >
          <KitField
            :label="$t('host.threadCase.followUpWhen')"
            :hint="$t('host.threadCase.followUpWhenHint', { zone })"
            :error="followErrors.at"
          >
            <KitInput
              ref="followAtEl"
              v-model="draftAt"
              name="followUpAt"
              type="datetime-local"
              :readonly="busy"
            />
          </KitField>
          <KitField
            :label="$t('host.threadCase.followUpBot')"
            :error="followErrors.bot"
          >
            <KitSelect
              v-model="draftBot"
              name="followUpBotId"
              :options="botOptions"
              :placeholder="$t('host.threadCase.followUpBotPlaceholder')"
              :disabled="busy"
            />
          </KitField>
          <p class="next">
            <span class="next-key">{{ $t('host.threadCase.followUpWhat') }}</span>
            {{ current.nextAction || $t('host.threadCase.followUpNoWhat') }}
          </p>
          <p class="hint">
            {{ $t('host.threadCase.followUpHint') }}
          </p>
          <div class="actions">
            <KitButton
              type="submit"
              size="sm"
              :disabled="busy"
            >
              {{ busy ? $t('common.saving') : $t('common.save') }}
            </KitButton>
            <KitButton
              size="sm"
              variant="ghost"
              :disabled="busy"
              @click="cancelFollowUp"
            >
              {{ $t('common.cancel') }}
            </KitButton>
          </div>
        </form>
      </div>
    </div>

    <form
      v-else
      class="edit"
      @submit.prevent="save"
    >
      <KitField
        :label="$t('host.threadCase.label')"
        :hint="`${draftLabel.length}/${CASE_LABEL_MAX}`"
      >
        <KitInput
          ref="labelEl"
          v-model="draftLabel"
          name="label"
          autocomplete="off"
          :maxlength="CASE_LABEL_MAX"
        />
      </KitField>
      <KitField
        :label="$t('host.threadCase.nextAction')"
        :hint="`${draftNextAction.length}/${CASE_NEXT_ACTION_MAX}`"
      >
        <KitInput
          v-model="draftNextAction"
          name="nextAction"
          autocomplete="off"
          :maxlength="CASE_NEXT_ACTION_MAX"
        />
      </KitField>
      <KitToggle
        v-model="draftDone"
        name="status"
        :label="$t('host.threadCase.doneToggle')"
      />
      <p
        v-if="error"
        class="note"
        role="alert"
      >
        <KitChip tone="warn">
          {{ error }}
        </KitChip>
      </p>
      <div class="actions">
        <KitButton
          type="submit"
          size="sm"
          :disabled="busy"
        >
          {{ busy ? $t('common.saving') : $t('common.save') }}
        </KitButton>
        <KitButton
          size="sm"
          variant="ghost"
          :disabled="busy"
          @click="cancel"
        >
          {{ $t('common.cancel') }}
        </KitButton>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import type { CaseStatus, ThreadCase, ThreadListItem } from '@dostigus/shared'
import { CASE_LABEL_MAX, CASE_NEXT_ACTION_MAX } from '@dostigus/shared'
import { KitButton, KitChip, KitField, KitInput, KitListRow, KitSelect, KitToggle } from '@dostigus/ui-kit'
import { defaultFollowUpInput, followUpInputValue } from '../utils/case-follow-up'
import { hostStatusCopy } from '../utils/host-status-copy'
import { scheduleWhenLabel } from '../utils/schedule-copy'

const props = defineProps<{
  thread: ThreadListItem
  /** Open straight into the form when the Thread has no Case yet. */
  autoEdit?: boolean
  /** Cluster timezone. Follow-up times are read and written in it. */
  timeZone?: string
}>()

const emit = defineEmits<{
  saved: [thread: ThreadListItem]
}>()

const { t, locale } = useI18n()

const editing = ref(false)
const followEditing = ref(false)
const draftAt = ref('')
const draftBot = ref('')
const followErrors = reactive({ at: '', bot: '' })
const followAtEl = ref<InstanceType<typeof KitInput> | null>(null)
const zone = computed(() => props.timeZone || 'UTC')
const hostLocale = computed(() => locale.value === 'ru' ? 'ru' as const : 'en' as const)
const botOptions = computed(() => props.thread.participants
  .filter((participant) => participant.kind === 'bot')
  .map((participant) => ({ value: participant.id, label: participant.name })))
const followUpSummary = computed(() => {
  const value = current.value
  if (!value?.followUpAt) {
    return ''
  }
  const when = scheduleWhenLabel(value.followUpAt, zone.value, Date.now(), hostLocale.value)
  const bot = props.thread.participants.find((item) => item.kind === 'bot' && item.id === value.followUpBotId)?.name
  return bot ? t('host.threadCase.followUpSummary', { when, bot }) : when
})
const busy = ref(false)
const error = ref('')
const draftLabel = ref('')
const draftNextAction = ref('')
const draftDone = ref(false)
const labelEl = ref<InstanceType<typeof KitInput> | null>(null)

const current = computed<ThreadCase | null>(() => props.thread.case)

onMounted(() => {
  if (props.autoEdit && !current.value) {
    void startEdit()
  }
})

function statusText(status: CaseStatus) {
  return status === 'done' ? t('host.threadCase.done') : t('host.threadCase.open')
}

async function startEdit() {
  draftLabel.value = current.value?.label ?? ''
  draftNextAction.value = current.value?.nextAction ?? ''
  draftDone.value = current.value?.status === 'done'
  error.value = ''
  editing.value = true
  await nextTick()
  // The Sheet focus trap moves focus to its close button after this block mounts.
  setTimeout(() => labelEl.value?.focus(), 0)
}

function cancel() {
  editing.value = false
  error.value = ''
}

async function startFollowUp() {
  const value = current.value
  draftAt.value = value?.followUpAt
    ? followUpInputValue(value.followUpAt, zone.value)
    : defaultFollowUpInput(Date.now(), zone.value)
  const bots = botOptions.value
  draftBot.value = value?.followUpBotId ?? (bots.length === 1 ? bots[0]?.value ?? '' : '')
  followErrors.at = ''
  followErrors.bot = ''
  error.value = ''
  followEditing.value = true
  await nextTick()
  followAtEl.value?.focus()
}

function cancelFollowUp() {
  followEditing.value = false
  error.value = ''
}

async function saveFollowUp() {
  if (busy.value) {
    return
  }
  followErrors.at = draftAt.value ? '' : t('host.threadCase.followUpWhenRequired')
  followErrors.bot = draftBot.value ? '' : t('host.threadCase.followUpBotRequired')
  if (followErrors.at || followErrors.bot) {
    return
  }
  const ok = await write({ followUpAt: draftAt.value, followUpBotId: draftBot.value })
  if (ok) {
    followEditing.value = false
  }
}

async function clearFollowUp() {
  if (busy.value) {
    return
  }
  await write({ followUpAt: null })
}

async function write(body: {
  status?: CaseStatus
  label?: string
  nextAction?: string
  followUpAt?: string | null
  followUpBotId?: string
}) {
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<{ thread: ThreadListItem }>(`/api/threads/${props.thread.id}/case`, {
      method: 'PATCH',
      body,
    })
    emit('saved', res.thread)
    return true
  } catch (caught) {
    error.value = hostStatusCopy(caught, t, 'host.threadCase.saveFailed')
    return false
  } finally {
    busy.value = false
  }
}

async function save() {
  if (busy.value) {
    return
  }
  const ok = await write({
    status: draftDone.value ? 'done' : 'open',
    label: draftLabel.value,
    nextAction: draftNextAction.value,
  })
  if (ok) {
    editing.value = false
  }
}

async function flip() {
  if (busy.value || !current.value) {
    return
  }
  await write({ status: current.value.status === 'done' ? 'open' : 'done' })
}
</script>

<style scoped>
.case {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.head h2 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-muted);
}

.view,
.edit {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.label,
.next,
.hint,
.note {
  margin: 0;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.label {
  font-weight: 700;
}

.follow {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--line-soft);
}

.follow > .next-key,
.follow-when {
  margin: 0;
}

.follow-when {
  line-height: 1.45;
}

.next-key {
  display: block;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.hint {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
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

.add-case :deep(.kit-row-title) {
  color: var(--accent);
}
</style>
