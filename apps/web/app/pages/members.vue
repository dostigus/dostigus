<template>
  <div class="page">
    <header class="top">
      <div class="lead">
        <HostMenuButton />
        <div>
          <p class="mark">
            Members
          </p>
          <p class="sub">
            People on this Host
          </p>
        </div>
      </div>
      <div class="header-actions">
        <KitButton
          type="button"
          @click="addOpen = true"
        >
          Add Member
        </KitButton>
      </div>
    </header>

    <main class="stage">
      <p
        v-if="loadError"
        class="banner"
      >
        Could not load Members.
      </p>

      <section
        v-else-if="members.length === 0"
        class="empty"
      >
        <GooseSticker
          class="sticker"
          name="peek"
          alt=""
        />
        <p class="kicker">
          Members
        </p>
        <h1>No Members yet</h1>
        <p class="hint">
          Add someone so they can sign in on this Host and open Chat.
        </p>
        <KitButton
          type="button"
          @click="addOpen = true"
        >
          Add Member
        </KitButton>
      </section>

      <ul
        v-else
        class="people"
        aria-label="Members"
      >
        <li
          v-for="member in members"
          :key="member.id"
          class="person"
        >
          <div class="who">
            <p class="name">
              {{ member.displayName }}
            </p>
            <p class="meta">
              {{ member.email ?? member.username }}
            </p>
          </div>
          <p
            v-if="member.disabledAt"
            class="meta"
          >
            Sign-in off
          </p>
          <div
            v-else-if="confirmId === member.id"
            class="row-actions"
          >
            <button
              type="button"
              class="ghost"
              @click="confirmId = ''"
            >
              Cancel
            </button>
            <button
              type="button"
              class="danger"
              :disabled="busyId === member.id"
              @click="turnOff(member.id)"
            >
              {{ busyId === member.id ? 'Turning off…' : 'Turn off sign-in' }}
            </button>
          </div>
          <button
            v-else
            type="button"
            class="ghost"
            @click="confirmId = member.id"
          >
            Turn off sign-in
          </button>
        </li>
      </ul>

      <p
        v-if="message && !addOpen"
        class="flash"
        :class="{ error: messageError }"
      >
        {{ message }}
      </p>

      <KitSheet
        v-model:open="addOpen"
        title="Add a Member"
        description="They sign in with this email or username and can Chat with Bots."
      >
        <template #media>
          <GooseSticker
            name="ok"
            size="sm"
            alt=""
          />
        </template>
        <form @submit.prevent="add">
          <label class="field">
            <span>Display name</span>
            <input
              v-model="displayName"
              type="text"
              autocomplete="off"
              required
            >
          </label>

          <label class="field">
            <span>Email or username</span>
            <input
              v-model="login"
              type="text"
              autocomplete="off"
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
            v-if="message && addOpen"
            class="flash"
            :class="{ error: messageError }"
          >
            {{ message }}
          </p>

          <div class="actions">
            <KitButton
              variant="ghost"
              type="button"
              @click="addOpen = false"
            >
              Cancel
            </KitButton>
            <KitButton
              type="submit"
              :disabled="adding"
            >
              {{ adding ? 'Adding…' : 'Add Member' }}
            </KitButton>
          </div>
        </form>
      </KitSheet>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { Member } from '@dostigus/shared'
import { GooseSticker, KitButton, KitSheet } from '@dostigus/ui-kit'

definePageMeta({ layout: 'host' })

useHead({ title: 'Dostigus · Members' })

const { data, error: loadError, refresh } = await useFetch<{ members: Member[] }>('/api/members')
const members = computed(() => data.value?.members ?? [])

const addOpen = ref(false)
const displayName = ref('')
const login = ref('')
const password = ref('')
const confirm = ref('')
const adding = ref(false)
const busyId = ref('')
const confirmId = ref('')
const message = ref('')
const messageError = ref(false)

watch(addOpen, (isOpen) => {
  if (isOpen) {
    message.value = ''
    messageError.value = false
  }
})

async function add() {
  message.value = ''
  messageError.value = false
  if (password.value !== confirm.value) {
    message.value = 'Passwords do not match.'
    messageError.value = true
    return
  }
  adding.value = true
  try {
    await $fetch('/api/members', {
      method: 'POST',
      body: {
        displayName: displayName.value.trim(),
        login: login.value.trim(),
        password: password.value,
      },
    })
    displayName.value = ''
    login.value = ''
    password.value = ''
    confirm.value = ''
    message.value = 'Added.'
    addOpen.value = false
    await refresh()
  } catch (error) {
    const fetchError = error as { data?: { statusMessage?: string }, statusMessage?: string }
    message.value = fetchError.data?.statusMessage
      ?? fetchError.statusMessage
      ?? 'Could not add this Member.'
    messageError.value = true
  } finally {
    adding.value = false
  }
}

async function turnOff(id: string) {
  busyId.value = id
  message.value = ''
  messageError.value = false
  try {
    await $fetch(`/api/members/${id}/disable`, { method: 'POST' })
    confirmId.value = ''
    await refresh()
  } catch {
    message.value = 'Could not turn off sign-in.'
    messageError.value = true
  } finally {
    busyId.value = ''
  }
}
</script>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.4rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.lead {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.mark {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sub {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 1.6rem 1.4rem 3rem;
}

.banner {
  margin: 0 auto 1rem;
  max-width: 32rem;
  color: var(--accent);
}

.empty {
  max-width: 26rem;
  margin: 1.5rem auto 1.5rem;
  text-align: center;
}

.sticker {
  margin-bottom: 0.35rem;
}

.kicker {
  margin: 0 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent);
}

h1 {
  margin: 0 0 0.55rem;
  font-size: 1.7rem;
  font-weight: 700;
}

.hint,
.meta {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}

.empty .hint {
  margin: 0 0 1.2rem;
}

.people {
  list-style: none;
  margin: 0 auto 1.25rem;
  padding: 0;
  max-width: 32rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.person {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.15rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.who {
  min-width: 0;
}

.name {
  margin: 0;
  font-weight: 700;
}

.meta {
  font-size: 0.85rem;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.45rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
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

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.35rem;
}

.ghost,
.danger {
  appearance: none;
  border-radius: 999px;
  padding: 0.55rem 1rem;
  cursor: pointer;
}

.ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
}

.danger {
  border: 1px solid var(--accent-dim);
  background: transparent;
  color: var(--accent);
}

.ghost:disabled,
.danger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
