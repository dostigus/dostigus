<template>
  <HostAuthShell>
    <form @submit.prevent="submit">
      <p class="kicker">
        First visit
      </p>
      <h1>Create your Owner</h1>
      <p class="hint">
        This Host needs one Owner. Choose a name or email and a password.
      </p>

      <label class="field">
        <span>Email or username</span>
        <input
          v-model="login"
          type="text"
          autocomplete="username"
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
        {{ busy ? 'Creating…' : 'Create Owner' }}
      </button>
    </form>
  </HostAuthShell>
</template>

<script setup lang="ts">
useHead({ title: 'Dostigus · Create Owner' })

const { fetch: refreshSession } = useUserSession()
const login = ref('')
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const message = ref('')

async function submit() {
  message.value = ''
  if (password.value !== confirm.value) {
    message.value = 'Passwords do not match.'
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
    message.value = error instanceof Error
      ? error.message
      : 'Could not create the Owner.'
    const fetchError = error as { data?: { statusMessage?: string }, statusMessage?: string }
    message.value = fetchError.data?.statusMessage
      ?? fetchError.statusMessage
      ?? message.value
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
  border-radius: 999px;
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
</style>
