<template>
  <HostAuthShell>
    <div v-if="phase === 'loading'">
      <p class="kicker">
        Invite
      </p>
      <h1>Checking this link</h1>
      <p class="hint">
        One moment.
      </p>
    </div>

    <div v-else-if="phase === 'session'">
      <p class="kicker">
        Invite
      </p>
      <h1>Sign out first</h1>
      <p class="hint">
        Open this link while you are signed out. A Member is not created on the account that is already signed in.
      </p>
      <p
        v-if="message"
        class="flash error"
      >
        {{ message }}
      </p>
      <button
        type="button"
        class="solid"
        :disabled="busy"
        @click="signOutAndContinue"
      >
        {{ busy ? 'Signing out…' : 'Sign out' }}
      </button>
    </div>

    <div v-else-if="phase === 'invalid'">
      <p class="kicker">
        Invite
      </p>
      <h1>This link is invalid</h1>
      <p class="hint">
        It may have expired or already been used.
      </p>
      <NuxtLink
        class="text-link"
        to="/login"
      >
        Sign in
      </NuxtLink>
    </div>

    <form
      v-else
      @submit.prevent="submit"
    >
      <p class="kicker">
        Invite
      </p>
      <h1>Join this Host</h1>
      <p class="hint">
        Choose a display name and a password. This email is your login.
      </p>

      <label class="field">
        <span>Email</span>
        <input
          :value="email"
          type="email"
          readonly
          autocomplete="username"
        >
      </label>

      <label class="field">
        <span>Display name</span>
        <input
          v-model="displayName"
          type="text"
          autocomplete="name"
          required
        >
      </label>

      <label class="field">
        <span>Password</span>
        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        >
        <span class="field-hint">At least 8 characters</span>
      </label>

      <label class="field">
        <span>Confirm password</span>
        <input
          v-model="confirm"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        >
      </label>

      <p
        v-if="message"
        class="flash error"
      >
        {{ message }}
      </p>

      <button
        type="submit"
        class="solid"
        :disabled="busy"
      >
        {{ busy ? 'Joining…' : 'Join' }}
      </button>
    </form>
  </HostAuthShell>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

useHead({ title: 'Dostigus · Invite' })

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
    message.value = 'Could not sign out.'
  } finally {
    busy.value = false
  }
}

async function submit() {
  message.value = ''
  if (password.value !== confirm.value) {
    message.value = 'Passwords do not match.'
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
      message.value = statusMessage
      return
    }
    message.value = statusMessage || 'Could not join this Host.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.kicker {
  margin: 0 0 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent);
}

h1 {
  margin: 0 0 0.55rem;
  font-size: 1.65rem;
  font-weight: 700;
}

.hint {
  margin: 0 0 1.25rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.95rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.field-hint {
  font-size: 0.78rem;
}

input {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.9rem;
}

input:focus {
  outline: 1px solid var(--accent-dim);
}

input[readonly] {
  color: var(--text-muted);
  background: var(--surface);
}

.flash {
  margin: 0 0 1rem;
  font-size: 0.9rem;
}

.flash.error {
  color: var(--accent);
}

.solid {
  appearance: none;
  width: 100%;
  border: 0;
  border-radius: var(--radius);
  padding: 0.75rem 1.1rem;
  background: var(--accent);
  color: var(--accent-ink);
  cursor: pointer;
  font-weight: 600;
}

.solid:hover:not(:disabled) {
  filter: brightness(1.05);
}

.solid:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.text-link {
  color: var(--accent);
  font-weight: 700;
}
</style>
