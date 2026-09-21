<template>
  <div class="shell">
    <header class="top">
      <div>
        <p class="mark">
          Dostigus
        </p>
        <p class="sub">
          Host · Cluster
        </p>
      </div>
    </header>

    <main class="stage">
      <form
        class="card"
        @submit.prevent="submit"
      >
        <p class="kicker">
          Owner
        </p>
        <h1>Sign in</h1>
        <p class="hint">
          Sign in as the Cluster Owner. The Host session is a sealed cookie,
          separate from the MCP token.
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
            autocomplete="current-password"
            required
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
          {{ busy ? 'Signing in…' : 'Sign in' }}
        </button>

        <p class="note">
          Password reset is not available yet.
        </p>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Dostigus · Sign in' })

const { fetch: refreshSession } = useUserSession()
const login = ref('')
const password = ref('')
const busy = ref(false)
const message = ref('')

async function submit() {
  message.value = ''
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
    const fetchError = error as { data?: { statusMessage?: string }, statusMessage?: string }
    message.value = fetchError.data?.statusMessage
      ?? fetchError.statusMessage
      ?? 'Could not sign in.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.top {
  padding: 1.15rem 1.4rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.mark {
  margin: 0;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
}

.sub {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.stage {
  flex: 1;
  padding: 1.75rem 1.4rem 3rem;
}

.card {
  max-width: 26rem;
  margin: 2.5rem auto 0;
  padding: 1.45rem 1.4rem 1.5rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.kicker {
  margin: 0 0 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent);
}

h1 {
  margin: 0 0 0.55rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.hint,
.note {
  color: var(--text-muted);
  line-height: 1.45;
}

.hint {
  margin: 0 0 1.15rem;
}

.note {
  margin: 1rem 0 0;
  font-size: 0.85rem;
  text-align: center;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

input {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.7rem 0.85rem;
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
  padding: 0.7rem 1.1rem;
  background: var(--accent);
  color: var(--accent-ink);
  cursor: pointer;
}

.solid:hover:not(:disabled) {
  filter: brightness(1.05);
}

.solid:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
