<template>
  <HostAuthShell>
    <KitPanel
      as="form"
      :aria-labelledby="headId"
      @submit.prevent="submit"
    >
      <HostAuthHead
        :id="headId"
        :title="$t('auth.onboarding.title')"
        :hint="$t('auth.onboarding.hint')"
      />

      <KitField
        :label="$t('auth.field.login')"
        :error="errors.login"
        required
      >
        <KitInput
          v-model="login"
          autocomplete="username"
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
          {{ busy ? $t('auth.onboarding.submitBusy') : $t('auth.onboarding.submit') }}
        </KitButton>
      </template>
    </KitPanel>
  </HostAuthShell>
</template>

<script setup lang="ts">
import type { MemberFormField } from '../utils/member-form'
import { KitButton, KitField, KitInput, KitPanel } from '@dostigus/ui-kit'
import { hostStatusCopy } from '../utils/host-status-copy'
import { memberErrorField } from '../utils/member-form'

const { t } = useI18n()
useHead({ title: () => t('auth.onboarding.titleDoc') })

const headId = useId()
const { fetch: refreshSession } = useUserSession()
const login = ref('')
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const errors = ref<Partial<Record<MemberFormField | 'confirm', string>>>({})

async function submit() {
  errors.value = {}
  if (password.value !== confirm.value) {
    errors.value = { confirm: t('auth.error.passwordMismatch') }
    return
  }
  busy.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        login: login.value.trim(),
        password: password.value,
      },
    })
    await refreshSession()
    clearNuxtData('owner-auth-status')
    await navigateTo('/')
  } catch (error) {
    errors.value = { [memberErrorField(error, ['login', 'password'])]: hostStatusCopy(error, t, 'auth.error.fallbackCreateOwner') }
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
</style>
