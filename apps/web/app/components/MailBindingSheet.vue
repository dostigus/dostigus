<template>
  <div class="mailbox">
    <p class="hint">
      {{ $t('mailbox.hint') }}
    </p>
    <p
      v-if="loadError"
      class="error"
      role="alert"
    >
      {{ loadError }}
    </p>
    <p
      v-else-if="loading"
      class="hint"
    >
      {{ $t('closet.loading') }}
    </p>
    <form
      v-else
      class="form"
      autocomplete="off"
      @submit.prevent="save"
    >
      <section
        class="side"
        aria-labelledby="mailbox-imap-heading"
      >
        <h3 id="mailbox-imap-heading">
          {{ $t('mailbox.imap') }}
        </h3>
        <div class="pair">
          <KitField
            :label="$t('mailbox.host')"
            required
          >
            <KitInput
              v-model="imapHost"
              name="imapHost"
              placeholder="imap.example.com"
              spellcheck="false"
              autocapitalize="off"
              :readonly="busy"
            />
          </KitField>
          <KitField
            :label="$t('mailbox.port')"
            required
          >
            <KitInput
              v-model="imapPort"
              name="imapPort"
              type="number"
              inputmode="numeric"
              min="1"
              max="65535"
              :readonly="busy"
            />
          </KitField>
        </div>
        <KitField
          :label="$t('mailbox.user')"
          :hint="$t('mailbox.userHint')"
          required
        >
          <KitInput
            v-model="imapUser"
            name="imapUser"
            autocomplete="username"
            spellcheck="false"
            autocapitalize="off"
            :readonly="busy"
          />
        </KitField>
        <KitField
          :label="$t('mailbox.password')"
          :hint="bound ? $t('mailbox.passwordKeep') : undefined"
          :required="!bound"
        >
          <KitInput
            v-model="imapPassword"
            name="imapPassword"
            type="password"
            autocomplete="new-password"
            :placeholder="bound ? '••••••••' : undefined"
            :readonly="busy"
          />
        </KitField>
      </section>

      <section
        class="side"
        aria-labelledby="mailbox-smtp-heading"
      >
        <h3 id="mailbox-smtp-heading">
          {{ $t('mailbox.smtp') }}
        </h3>
        <div class="pair">
          <KitField
            :label="$t('mailbox.host')"
            required
          >
            <KitInput
              v-model="smtpHost"
              name="smtpHost"
              placeholder="smtp.example.com"
              spellcheck="false"
              autocapitalize="off"
              :readonly="busy"
            />
          </KitField>
          <KitField
            :label="$t('mailbox.port')"
            required
          >
            <KitInput
              v-model="smtpPort"
              name="smtpPort"
              type="number"
              inputmode="numeric"
              min="1"
              max="65535"
              :readonly="busy"
            />
          </KitField>
        </div>
        <KitToggle
          v-model="sameLogin"
          class="switch-row"
          name="smtpSameLogin"
          :label="$t('mailbox.sameLogin')"
          :disabled="busy"
        />
        <template v-if="!sameLogin">
          <KitField
            :label="$t('mailbox.user')"
            required
          >
            <KitInput
              v-model="smtpUser"
              name="smtpUser"
              spellcheck="false"
              autocapitalize="off"
              :readonly="busy"
            />
          </KitField>
          <KitField
            :label="$t('mailbox.password')"
            :hint="smtpPasswordSaved ? $t('mailbox.passwordKeep') : undefined"
            :required="!smtpPasswordSaved"
          >
            <KitInput
              v-model="smtpPassword"
              name="smtpPassword"
              type="password"
              autocomplete="new-password"
              :placeholder="smtpPasswordSaved ? '••••••••' : undefined"
              :readonly="busy"
            />
          </KitField>
        </template>
      </section>

      <div
        v-if="checks.length > 0"
        class="checks"
        role="status"
      >
        <KitChip
          v-for="check in checks"
          :key="check.side"
          :tone="check.ok ? 'ok' : 'warn'"
        >
          {{ check.label }}
        </KitChip>
      </div>

      <p
        v-if="formError"
        class="error"
        role="alert"
      >
        {{ formError }}
      </p>
      <p
        v-else-if="savedNote"
        class="note"
        role="status"
      >
        <KitChip tone="ok">
          {{ savedNote }}
        </KitChip>
      </p>

      <div class="actions">
        <KitButton
          variant="ghost"
          :disabled="busy || !canSubmit"
          @click="testConnection"
        >
          {{ testing ? $t('mailbox.testing') : $t('mailbox.test') }}
        </KitButton>
        <KitButton
          type="submit"
          :disabled="busy || !canSubmit"
        >
          {{ saving ? $t('mailbox.saving') : $t('mailbox.save') }}
        </KitButton>
      </div>

      <div
        v-if="bound && !confirming"
        class="remove"
      >
        <KitButton
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="confirming = true"
        >
          {{ $t('mailbox.remove') }}
        </KitButton>
      </div>
      <div
        v-else-if="bound"
        class="remove confirm"
      >
        <p>{{ $t('mailbox.confirmRemove') }}</p>
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
            {{ $t('mailbox.removeConfirm') }}
          </KitButton>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { KitButton, KitChip, KitField, KitInput, KitToggle } from '@dostigus/ui-kit'
import { hostStatusCopy, hostStatusMessage } from '../utils/host-status-copy'

type MailEndpointView = { host: string, port: number, user: string }
type MailBindingState = {
  binding: {
    imap: MailEndpointView
    smtp: MailEndpointView
    smtpSameLogin: boolean
    hasPassword: true
    updatedAt: number
  } | null
}
type MailCheck = { ok: boolean, error: string | null, statusCode: number | null }

const props = defineProps<{
  botId: string
}>()

const emit = defineEmits<{
  changed: [state: MailBindingState]
}>()

const { t } = useI18n()

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const testing = ref(false)
const confirming = ref(false)
const formError = ref('')
const savedNote = ref('')
const state = ref<MailBindingState>({ binding: null })

const imapHost = ref('')
const imapPort = ref('993')
const imapUser = ref('')
const imapPassword = ref('')
const smtpHost = ref('')
const smtpPort = ref('465')
const sameLogin = ref(true)
const smtpUser = ref('')
const smtpPassword = ref('')
const checks = ref<Array<{ side: 'imap' | 'smtp', ok: boolean, label: string }>>([])

const busy = computed(() => saving.value || testing.value)
const bound = computed(() => state.value.binding !== null)
const smtpPasswordSaved = computed(() => Boolean(state.value.binding && !state.value.binding.smtpSameLogin))
const canSubmit = computed(() => Boolean(
  imapHost.value.trim()
  && String(imapPort.value).trim()
  && imapUser.value.trim()
  && (bound.value || imapPassword.value)
  && smtpHost.value.trim()
  && String(smtpPort.value).trim(),
))

function smtpGuess(host: string): string {
  const trimmed = host.trim()
  return /^imap\./i.test(trimmed) ? trimmed.replace(/^imap\./i, 'smtp.') : ''
}

watch(imapHost, (next, previous) => {
  const current = smtpHost.value.trim()
  if (!current || current === smtpGuess(previous)) {
    smtpHost.value = smtpGuess(next)
  }
})

function fill(next: MailBindingState) {
  state.value = next
  const binding = next.binding
  if (!binding) {
    return
  }
  imapHost.value = binding.imap.host
  imapPort.value = String(binding.imap.port)
  imapUser.value = binding.imap.user
  smtpHost.value = binding.smtp.host
  smtpPort.value = String(binding.smtp.port)
  sameLogin.value = binding.smtpSameLogin
  smtpUser.value = binding.smtpSameLogin ? '' : binding.smtp.user
  imapPassword.value = ''
  smtpPassword.value = ''
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    fill(await $fetch<MailBindingState>(`/api/bots/${props.botId}/mail`))
  } catch {
    loadError.value = t('mailbox.loadFailed')
  } finally {
    loading.value = false
  }
}

function body() {
  return {
    imapHost: imapHost.value.trim(),
    imapPort: Number(imapPort.value),
    imapUser: imapUser.value.trim(),
    imapPassword: imapPassword.value,
    smtpHost: smtpHost.value.trim(),
    smtpPort: Number(smtpPort.value),
    smtpUser: sameLogin.value ? '' : smtpUser.value.trim(),
    smtpPassword: sameLogin.value ? '' : smtpPassword.value,
  }
}

function checkReason(check: MailCheck): string {
  const message = check.error ?? ''
  if (message === 'blocked destination') {
    return t('mailbox.error.blocked')
  }
  return hostStatusCopy({ statusMessage: message }, t, 'mailbox.saveFailed')
}

async function testConnection() {
  if (busy.value) {
    return
  }
  testing.value = true
  formError.value = ''
  savedNote.value = ''
  checks.value = []
  try {
    const result = await $fetch<{ imap: MailCheck, smtp: MailCheck }>(`/api/bots/${props.botId}/mail/test`, {
      method: 'POST',
      body: body(),
    })
    checks.value = [
      { side: 'imap', ok: result.imap.ok, label: result.imap.ok ? t('mailbox.imapOk') : t('mailbox.imapFailed', { reason: checkReason(result.imap) }) },
      { side: 'smtp', ok: result.smtp.ok, label: result.smtp.ok ? t('mailbox.smtpOk') : t('mailbox.smtpFailed', { reason: checkReason(result.smtp) }) },
    ]
  } catch (error) {
    formError.value = hostStatusCopy(error, t, 'mailbox.saveFailed')
  } finally {
    testing.value = false
  }
}

async function save() {
  if (busy.value || !canSubmit.value) {
    return
  }
  saving.value = true
  formError.value = ''
  savedNote.value = ''
  try {
    const next = await $fetch<MailBindingState>(`/api/bots/${props.botId}/mail`, {
      method: 'PUT',
      body: body(),
    })
    fill(next)
    savedNote.value = t('mailbox.saved')
    emit('changed', next)
  } catch (error) {
    formError.value = hostStatusMessage(error)
      ? hostStatusCopy(error, t, 'mailbox.saveFailed')
      : t('mailbox.saveFailed')
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (busy.value) {
    return
  }
  saving.value = true
  formError.value = ''
  try {
    await $fetch(`/api/bots/${props.botId}/mail`, { method: 'DELETE' })
    const next: MailBindingState = { binding: null }
    state.value = next
    imapPassword.value = ''
    smtpPassword.value = ''
    checks.value = []
    confirming.value = false
    emit('changed', next)
  } catch (error) {
    formError.value = hostStatusCopy(error, t, 'mailbox.saveFailed')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.mailbox,
.form,
.side {
  display: flex;
  flex-direction: column;
}

.mailbox {
  gap: 0.85rem;
}

.form {
  gap: 1.1rem;
}

.side {
  gap: 0.75rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--line);
}

.side h3 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-muted);
}

.pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 6.5rem;
  gap: 0.6rem;
}

.switch-row {
  border: 1px solid var(--line);
  background: var(--bg);
  border-radius: var(--radius);
  padding: 0.75rem 0.9rem;
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
}

.remove {
  padding-top: 0.9rem;
  border-top: 1px solid var(--line);
}

.confirm p {
  margin: 0 0 0.55rem;
}

.confirm .actions {
  justify-content: flex-start;
}

.hint,
.error,
.note {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
}

.hint {
  color: var(--text-muted);
}

.error {
  color: var(--accent);
  font-weight: 600;
}
</style>
