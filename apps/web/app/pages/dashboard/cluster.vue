<template>
  <div class="cluster">
    <header class="head">
      <h1>{{ $t('dashboard.cluster.title') }}</h1>
      <p>{{ $t('dashboard.cluster.lead') }}</p>
    </header>

    <form
      class="card"
      @submit.prevent="saveLocale"
    >
      <p class="mark">
        {{ $t('settings.other.locale.title') }}
      </p>
      <p class="hint">
        {{ $t('settings.other.locale.hint') }}
      </p>
      <fieldset class="locale-list">
        <legend class="sr-only">
          {{ $t('settings.other.locale.title') }}
        </legend>
        <label
          v-for="item in HOST_LOCALES"
          :key="item"
          class="locale-option"
        >
          <input
            v-model="localeInput"
            type="radio"
            name="locale"
            :value="item"
          >
          <span>{{ $t(item === 'en' ? 'settings.other.locale.en' : 'settings.other.locale.ru') }}</span>
        </label>
      </fieldset>
      <p
        v-if="localeMessage"
        class="flash"
        :class="{ error: localeMessageError }"
      >
        {{ localeMessage }}
      </p>
      <div class="actions">
        <button
          type="submit"
          class="solid"
          :disabled="localeSaving || localeInput === currentLocale"
        >
          {{ localeSaving ? $t('common.saving') : $t('settings.other.locale.save') }}
        </button>
      </div>
    </form>

    <form
      class="card"
      @submit.prevent="saveTimezone"
    >
      <p class="mark">
        {{ $t('settings.other.timezone.title') }}
      </p>
      <p class="hint">
        {{ $t('settings.other.timezone.hint') }}
      </p>
      <p
        v-if="timezone?.source === 'env'"
        class="note"
      >
        {{ $t('settings.other.timezone.fromEnv', { value: timezone.effective }) }}
      </p>
      <p
        v-else-if="timezone && !timezone.stored"
        class="note"
      >
        {{ $t('settings.other.timezone.usingUtc') }}
      </p>
      <label class="field">
        <span>{{ $t('settings.other.timezone.label') }}</span>
        <input
          v-model="timezoneInput"
          type="text"
          name="timezone"
          placeholder="America/New_York"
          autocomplete="off"
          spellcheck="false"
        >
      </label>
      <p
        v-if="timezoneMessage"
        class="flash"
        :class="{ error: timezoneMessageError }"
      >
        {{ timezoneMessage }}
      </p>
      <div class="actions">
        <button
          type="submit"
          class="solid"
          :disabled="timezoneSaving || !timezoneInput.trim()"
        >
          {{ timezoneSaving ? $t('common.saving') : $t('settings.other.timezone.save') }}
        </button>
      </div>
    </form>

    <form
      class="card"
      @submit.prevent="saveAllowlist"
    >
      <p class="mark">
        {{ $t('settings.other.allowlist.title') }}
      </p>
      <p class="hint">
        {{ $t('settings.other.allowlist.hint') }}
      </p>
      <p
        v-if="allowlist && allowlist.length === 0"
        class="note"
      >
        {{ $t('settings.other.allowlist.empty') }}
      </p>
      <label class="field">
        <span>{{ $t('settings.other.allowlist.label') }}</span>
        <textarea
          v-model="allowlistInput"
          name="http-allowlist"
          rows="4"
          placeholder="api.open-meteo.com"
          autocomplete="off"
          spellcheck="false"
        />
      </label>
      <p
        v-if="allowlistMessage"
        class="flash"
        :class="{ error: allowlistMessageError }"
      >
        {{ allowlistMessage }}
      </p>
      <div class="actions">
        <button
          type="submit"
          class="solid"
          :disabled="allowlistSaving"
        >
          {{ allowlistSaving ? $t('common.saving') : $t('settings.other.allowlist.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { HostLocale } from '@dostigus/ui-kit/locale'
import { HOST_LOCALES } from '@dostigus/ui-kit/locale'
import { hostStatusCopy } from '../../utils/host-status-copy'

type ClusterTimezoneSettings = {
  stored: string | null
  effective: string
  source: 'store' | 'env' | 'utc'
}

const { t } = useI18n()
const {
  current: currentLocale,
  saving: localeSaving,
  message: localeMessage,
  messageError: localeMessageError,
  choose,
} = useHostLocale()
const localeInput = ref<HostLocale>(currentLocale.value)

watch(currentLocale, (next) => {
  localeInput.value = next
})

const { data: timezoneData, refresh: refreshTimezone } = await useFetch<{
  timezone: ClusterTimezoneSettings
}>('/api/settings/timezone')

const { data: allowlistData, refresh: refreshAllowlist } = await useFetch<{
  hosts: string[]
}>('/api/settings/http-allowlist')

const timezoneInput = ref('')
const timezoneSaving = ref(false)
const timezoneMessage = ref('')
const timezoneMessageError = ref(false)
const timezone = computed(() => timezoneData.value?.timezone)
const allowlistInput = ref('')
const allowlistSaving = ref(false)
const allowlistMessage = ref('')
const allowlistMessageError = ref(false)
const allowlist = computed(() => allowlistData.value?.hosts)

watch(timezone, (next) => {
  timezoneInput.value = next?.stored ?? ''
}, { immediate: true })
watch(allowlist, (next) => {
  allowlistInput.value = next?.join('\n') ?? ''
}, { immediate: true })

function timezoneErrorText(error: unknown): string {
  return hostStatusCopy(error, t, 'settings.other.timezone.invalid')
}

function allowlistErrorText(error: unknown): string {
  return hostStatusCopy(error, t, 'settings.other.allowlist.invalid')
}

function hostsFromInput(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean)
}

async function saveAllowlist() {
  allowlistSaving.value = true
  allowlistMessage.value = ''
  allowlistMessageError.value = false
  try {
    const result = await $fetch<{ hosts: string[] }>('/api/settings/http-allowlist', {
      method: 'PUT',
      body: { hosts: hostsFromInput(allowlistInput.value) },
    })
    allowlistData.value = result
    allowlistInput.value = result.hosts.join('\n')
    allowlistMessage.value = result.hosts.length === 0
      ? t('settings.other.allowlist.cleared')
      : t('settings.other.allowlist.saved')
  } catch (error) {
    allowlistMessage.value = allowlistErrorText(error)
    allowlistMessageError.value = true
  } finally {
    allowlistSaving.value = false
    await refreshAllowlist()
  }
}

async function saveTimezone() {
  timezoneSaving.value = true
  timezoneMessage.value = ''
  timezoneMessageError.value = false
  try {
    const result = await $fetch<{ timezone: ClusterTimezoneSettings }>('/api/settings/timezone', {
      method: 'PUT',
      body: { timezone: timezoneInput.value.trim() },
    })
    timezoneData.value = result
    timezoneInput.value = result.timezone.stored ?? ''
    timezoneMessage.value = t('settings.other.timezone.saved')
  } catch (error) {
    timezoneMessage.value = timezoneErrorText(error)
    timezoneMessageError.value = true
  } finally {
    timezoneSaving.value = false
    await refreshTimezone()
  }
}

async function saveLocale() {
  await choose(localeInput.value)
}
</script>

<style scoped>
.cluster {
  max-width: 34rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.head h1 {
  margin: 0 0 0.35rem;
  font-size: 1.45rem;
}

.head p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}

.card {
  padding: 1.5rem 1.45rem 1.5rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--card);
}

.mark {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.note,
.hint {
  margin: 0 0 1.1rem;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

input,
textarea {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.9rem;
}

textarea {
  resize: vertical;
  min-height: 6.5rem;
  font-family: inherit;
}

input:focus,
textarea:focus {
  outline: 1px solid var(--accent-dim);
}

.flash {
  margin: 0 0 1rem;
  color: var(--text);
  font-size: 0.9rem;
}

.flash.error {
  color: var(--accent);
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.solid {
  appearance: none;
  border: 0;
  border-radius: var(--radius);
  padding: 0.55rem 1rem;
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 600;
  cursor: pointer;
}

.solid:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.locale-list {
  margin: 0 0 1rem;
  padding: 0;
  border: 0;
  display: flex;
  gap: 1rem;
}

.locale-option {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text);
  font-size: 0.95rem;
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
