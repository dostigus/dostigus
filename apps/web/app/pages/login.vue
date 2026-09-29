<template>
  <HostAuthShell>
    <KitPanel
      as="form"
      :aria-labelledby="headId"
      @submit.prevent="submit"
    >
      <HostAuthHead
        :id="headId"
        :title="$t('auth.login.title')"
        :hint="$t('auth.login.hint')"
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
        :error="errors.password"
        required
      >
        <KitInput
          v-model="password"
          type="password"
          autocomplete="current-password"
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
          {{ busy ? $t('auth.login.submitBusy') : $t('auth.login.submit') }}
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
useHead({ title: () => t('auth.login.titleDoc') })

const headId = useId()
const { fetch: refreshSession } = useUserSession()
const login = ref('')
const password = ref('')
const busy = ref(false)
const errors = ref<Partial<Record<MemberFormField, string>>>({})

async function submit() {
  errors.value = {}
  busy.value = true
  try {
    await $fetch('/api/auth/login', {
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
    errors.value = { [memberErrorField(error, ['login', 'password'])]: hostStatusCopy(error, t, 'auth.error.fallbackSignIn') }
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
