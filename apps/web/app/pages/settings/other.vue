<template>
  <div class="other">
    <header class="head">
      <h1>Прочее</h1>
      <p>Остальные настройки Cluster.</p>
    </header>

    <form
      class="card"
      @submit.prevent="saveTimezone"
    >
      <p class="mark">
        Cluster timezone
      </p>
      <p class="hint">
        Schedules use this wall clock. An IANA name such as America/New_York or UTC.
      </p>
      <p
        v-if="timezone?.source === 'env'"
        class="note"
      >
        Using {{ timezone.effective }} from the server until you save a timezone here.
      </p>
      <p
        v-else-if="timezone && !timezone.stored"
        class="note"
      >
        Using UTC until you set a timezone.
      </p>
      <label class="field">
        <span>IANA timezone</span>
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
          {{ timezoneSaving ? 'Saving…' : 'Save timezone' }}
        </button>
      </div>
    </form>

    <form
      class="card"
      @submit.prevent="saveAllowlist"
    >
      <p class="mark">
        Cluster http allowlist
      </p>
      <p class="hint">
        Hostnames Host HTTP get may reach. One hostname per line, exact match,
        no wildcards. Empty allows every public host. Loopback and private
        addresses stay blocked.
      </p>
      <p
        v-if="allowlist && allowlist.length === 0"
        class="note"
      >
        Empty — Bots may GET any public host.
      </p>
      <label class="field">
        <span>Hostnames</span>
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
          {{ allowlistSaving ? 'Saving…' : 'Save allowlist' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
type ClusterTimezoneSettings = {
  stored: string | null
  effective: string
  source: 'store' | 'env' | 'utc'
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

watch(timezone, (next) => {
  timezoneInput.value = next?.stored ?? ''
}, { immediate: true })
watch(allowlist, (next) => {
  allowlistInput.value = next?.join('\n') ?? ''
}, { immediate: true })

function timezoneErrorText(error: unknown): string {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    const statusMessage = error.statusMessage
    if (typeof statusMessage === 'string' && statusMessage.trim()) {
      return statusMessage
    }
  }
  return 'Cluster timezone must be an IANA name.'
}

function allowlistErrorText(error: unknown): string {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    const statusMessage = error.statusMessage
    if (typeof statusMessage === 'string' && statusMessage.trim()) {
      return statusMessage
    }
  }
  return 'HTTP allowlist entries are hostnames only.'
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
      ? 'Allowlist cleared. Public hosts are allowed.'
      : 'Allowlist saved.'
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
    timezoneMessage.value = 'Timezone saved.'
  } catch (error) {
    timezoneMessage.value = timezoneErrorText(error)
    timezoneMessageError.value = true
  } finally {
    timezoneSaving.value = false
    await refreshTimezone()
  }
}
</script>

<style scoped>
.other {
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
</style>
