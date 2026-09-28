<template>
  <div class="cluster">
    <header class="head">
      <h1>{{ $t('dashboard.cluster.title') }}</h1>
      <p>{{ $t('dashboard.cluster.lead') }}</p>
    </header>

    <KitCard
      as="form"
      :title="$t('settings.other.locale.title')"
      :description="$t('settings.other.locale.hint')"
      @submit.prevent="saveLocale"
    >
      <KitField
        :label="$t('settings.other.locale.label')"
        :error="localeMessageError ? localeMessage : undefined"
      >
        <KitSelect
          :model-value="localeInput"
          name="locale"
          :options="localeOptions"
          :disabled="localeSaving"
          @update:model-value="pickLocale"
        />
      </KitField>
      <template #actions>
        <span role="status">
          <KitChip
            v-if="localeMessage && !localeMessageError"
            tone="ok"
          >
            {{ localeMessage }}
          </KitChip>
        </span>
        <KitButton
          type="submit"
          :disabled="localeSaving || localeInput === currentLocale"
        >
          {{ localeSaving ? $t('common.saving') : $t('settings.other.locale.save') }}
        </KitButton>
      </template>
    </KitCard>

    <KitCard
      as="form"
      :title="$t('settings.other.timezone.title')"
      :description="$t('settings.other.timezone.hint')"
      @submit.prevent="saveTimezone"
    >
      <KitField
        :label="$t('settings.other.timezone.label')"
        :hint="timezoneNote"
        :error="timezoneMessageError ? timezoneMessage : undefined"
      >
        <KitInput
          v-model="timezoneInput"
          name="timezone"
          placeholder="America/New_York"
          autocomplete="off"
          spellcheck="false"
        />
      </KitField>
      <template #actions>
        <span role="status">
          <KitChip
            v-if="timezoneMessage && !timezoneMessageError"
            tone="ok"
          >
            {{ timezoneMessage }}
          </KitChip>
        </span>
        <KitButton
          type="submit"
          :disabled="timezoneSaving || !timezoneInput.trim()"
        >
          {{ timezoneSaving ? $t('common.saving') : $t('settings.other.timezone.save') }}
        </KitButton>
      </template>
    </KitCard>

    <KitCard
      as="form"
      :title="$t('settings.other.allowlist.title')"
      :description="$t('settings.other.allowlist.hint')"
      @submit.prevent="saveAllowlist"
    >
      <KitField
        :label="$t('settings.other.allowlist.label')"
        :hint="allowlist && allowlist.length === 0 ? $t('settings.other.allowlist.empty') : undefined"
        :error="allowlistMessageError ? allowlistMessage : undefined"
      >
        <KitTextarea
          v-model="allowlistInput"
          name="http-allowlist"
          :rows="4"
          placeholder="api.open-meteo.com"
          autocomplete="off"
          spellcheck="false"
        />
      </KitField>
      <template #actions>
        <span role="status">
          <KitChip
            v-if="allowlistMessage && !allowlistMessageError"
            tone="ok"
          >
            {{ allowlistMessage }}
          </KitChip>
        </span>
        <KitButton
          type="submit"
          :disabled="allowlistSaving"
        >
          {{ allowlistSaving ? $t('common.saving') : $t('settings.other.allowlist.save') }}
        </KitButton>
      </template>
    </KitCard>
  </div>
</template>

<script setup lang="ts">
import type { KitSelectOption } from '@dostigus/ui-kit'
import type { HostLocale } from '@dostigus/ui-kit/locale'
import { KitButton, KitCard, KitChip, KitField, KitInput, KitSelect, KitTextarea } from '@dostigus/ui-kit'
import { HOST_LOCALES, isHostLocale } from '@dostigus/ui-kit/locale'
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

const localeOptions = computed<KitSelectOption[]>(() => HOST_LOCALES.map((item) => ({
  value: item,
  label: t(item === 'en' ? 'settings.other.locale.en' : 'settings.other.locale.ru'),
})))

watch(currentLocale, (next) => {
  localeInput.value = next
})

function pickLocale(next: string | undefined) {
  if (next && isHostLocale(next)) {
    localeInput.value = next
  }
}

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
const timezoneNote = computed(() => {
  if (timezone.value?.source === 'env') {
    return t('settings.other.timezone.fromEnv', { value: timezone.value.effective })
  }
  if (timezone.value && !timezone.value.stored) {
    return t('settings.other.timezone.usingUtc')
  }
  return undefined
})

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
</style>
