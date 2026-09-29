<template>
  <HostAuthShell>
    <KitPanel
      v-if="phase === 'loading'"
      :aria-labelledby="headId"
      aria-busy="true"
    >
      <HostAuthHead
        :id="headId"
        :title="$t('auth.invite.loadingTitle')"
        :hint="$t('auth.invite.loadingHint')"
      />
    </KitPanel>

    <KitPanel
      v-else-if="phase === 'session'"
      :aria-labelledby="headId"
    >
      <HostAuthHead
        :id="headId"
        :title="$t('auth.invite.sessionTitle')"
        :hint="$t('auth.invite.sessionHint')"
      />
      <template #actions>
        <p
          v-if="message"
          class="error"
          role="alert"
        >
          {{ message }}
        </p>
        <KitButton
          :disabled="busy"
          @click="signOutAndContinue"
        >
          {{ busy ? $t('auth.invite.signOutBusy') : $t('auth.invite.signOut') }}
        </KitButton>
      </template>
    </KitPanel>

    <KitPanel
      v-else-if="phase === 'invalid'"
      :aria-labelledby="headId"
    >
      <HostAuthHead
        :id="headId"
        :title="$t('auth.invite.invalidTitle')"
        :hint="$t('auth.invite.invalidHint')"
      />
      <template #actions>
        <NuxtLink
          class="text-link"
          to="/login"
        >
          {{ $t('auth.invite.signInLink') }}
        </NuxtLink>
      </template>
    </KitPanel>

    <KitPanel
      v-else
      as="form"
      :aria-labelledby="headId"
      @submit.prevent="submit"
    >
      <HostAuthHead
        :id="headId"
        :title="$t('auth.invite.joinTitle')"
        :hint="$t('auth.invite.joinHint')"
      />

      <KitField
        :label="$t('auth.field.email')"
        :error="errors.login"
      >
        <KitInput
          :model-value="email"
          type="email"
          readonly
          autocomplete="username"
        />
      </KitField>

      <KitField
        :label="$t('auth.field.displayName')"
        :error="errors.displayName"
        required
      >
        <KitInput
          v-model="displayName"
          autocomplete="name"
        />
      </KitField>

      <KitField
        :label="$t('auth.field.password')"
        :hint="$t('auth.field.passwordMin')"
        :error="errors.password"
        required
      >
        <KitInput
          v-model="password"
          type="password"
          autocomplete="new-password"
          minlength="8"
        />
      </KitField>

      <KitField
        :label="$t('auth.field.confirmPassword')"
        :error="errors.confirm"
        required
      >
        <KitInput
          v-model="confirm"
          type="password"
          autocomplete="new-password"
          minlength="8"
        />
      </KitField>

      <template #actions>
        <p
          v-if="errors.form"
          class="error"
          role="alert"
        >
          {{ errors.form }}
        </p>
        <KitButton
          type="submit"
          :disabled="busy"
        >
          {{ busy ? $t('auth.invite.submitBusy') : $t('auth.invite.submit') }}
        </KitButton>
      </template>
    </KitPanel>
  </HostAuthShell>
</template>

<script setup lang="ts">
import type { MemberFormField } from '../../utils/member-form'
import { KitButton, KitField, KitInput, KitPanel } from '@dostigus/ui-kit'
import { hostStatusCopy } from '../../utils/host-status-copy'
import { memberErrorField } from '../../utils/member-form'

definePageMeta({ layout: false })

const { t } = useI18n()
useHead({ title: () => t('auth.invite.titleDoc') })

const headId = useId()
const route = useRoute()
const token = computed(() => {
  const value = route.params.token
  return typeof value === 'string' ? value : ''
})

const { loggedIn, clear, fetch: refreshSession } = useUserSession()

const displayName = ref('')
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const message = ref('')
const errors = ref<Partial<Record<MemberFormField | 'confirm', string>>>({})
const rejected = ref(false)

const inviteKey = computed(() => `invite-${token.value}`)

const { data, error, status, refresh } = await useAsyncData(
  inviteKey,
  async () => {
    if (loggedIn.value || !token.value) {
      return null
    }
    return $fetch<{ email: string, expiresAt: string }>(
      `/api/invites/${encodeURIComponent(token.value)}`,
    )
  },
)

const email = computed(() => data.value?.email ?? '')

const phase = computed(() => {
  if (loggedIn.value) {
    return 'session'
  }
  if (status.value === 'pending') {
    return 'loading'
  }
  if (rejected.value || error.value || !email.value) {
    return 'invalid'
  }
  return 'form'
})

async function signOutAndContinue() {
  message.value = ''
  busy.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clear()
    clearNuxtData('owner-auth-status')
    rejected.value = false
    await refresh()
  } catch {
    message.value = t('auth.error.fallbackSignOut')
  } finally {
    busy.value = false
  }
}

async function submit() {
  errors.value = {}
  if (password.value !== confirm.value) {
    errors.value = { confirm: t('auth.error.passwordMismatch') }
    return
  }
  busy.value = true
  try {
    await $fetch(`/api/invites/${encodeURIComponent(token.value)}`, {
      method: 'POST',
      body: {
        displayName: displayName.value.trim(),
        password: password.value,
      },
    })
    await refreshSession()
    clearNuxtData('owner-auth-status')
    await navigateTo('/')
  } catch (error) {
    const fetchError = error as {
      statusCode?: number
      status?: number
      data?: { statusMessage?: string }
      statusMessage?: string
    }
    const statusCode = fetchError.statusCode ?? fetchError.status
    const statusMessage = fetchError.data?.statusMessage ?? fetchError.statusMessage ?? ''
    if (statusCode === 404) {
      rejected.value = true
      return
    }
    if (statusCode === 409 && statusMessage.includes('Sign out')) {
      errors.value = { form: hostStatusCopy(error, t, 'auth.error.signOutFirst') }
      return
    }
    errors.value = { [memberErrorField(error, ['login', 'displayName', 'password'])]: hostStatusCopy(error, t, 'auth.error.fallbackJoin') }
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.error {
  flex: 1 1 100%;
  margin: 0;
  color: var(--accent);
  font-size: 0.9rem;
  font-weight: 600;
}

.text-link {
  color: var(--accent);
  font-weight: 700;
}
</style>
