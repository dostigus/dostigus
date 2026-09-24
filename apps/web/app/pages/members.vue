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
      <section
        class="invite"
        aria-label="Invite"
      >
        <h2>Invite by email</h2>
        <p class="hint">
          They choose a name and password. Copy the link and send it yourself.
        </p>
        <form
          class="invite-form"
          @submit.prevent="createInvite"
        >
          <label class="field">
            <span>Email</span>
            <input
              v-model="inviteEmail"
              type="email"
              autocomplete="off"
              required
            >
          </label>
          <KitButton
            type="submit"
            :disabled="inviting"
          >
            {{ inviting ? 'Creating…' : 'Create invite' }}
          </KitButton>
        </form>

        <div
          v-if="issuedUrl"
          class="link-box"
        >
          <p class="hint">
            Copy this link now. It is not shown again.
          </p>
          <div class="copy-row">
            <input
              readonly
              :value="issuedUrl"
              aria-label="Invite link"
              @focus="selectLink"
            >
            <button
              type="button"
              class="ghost"
              @click="copyLink"
            >
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>
        </div>

        <p
          v-if="inviteMessage"
          class="flash"
          :class="{ error: inviteMessageError }"
        >
          {{ inviteMessage }}
        </p>

        <h3>Pending invites</h3>
        <p
          v-if="inviteLoadError"
          class="banner"
        >
          Could not load invites.
        </p>
        <p
          v-else-if="invites.length === 0"
          class="meta"
        >
          No pending invites
        </p>
        <ul
          v-else
          class="people"
          aria-label="Pending invites"
        >
          <li
            v-for="invite in invites"
            :key="invite.id"
            class="person"
          >
            <div class="who">
              <p class="name">
                {{ invite.email }}
              </p>
              <p class="meta">
                {{ isExpired(invite.expiresAt) ? 'Expired' : 'Expires' }}
                {{ formatExpiry(invite.expiresAt) }}
              </p>
            </div>
            <div
              v-if="revokeConfirmId === invite.id"
              class="row-actions"
            >
              <button
                type="button"
                class="ghost"
                @click="revokeConfirmId = ''"
              >
                Cancel
              </button>
              <button
                type="button"
                class="danger"
                :disabled="busyInviteId === invite.id"
                @click="revoke(invite.id)"
              >
                {{ busyInviteId === invite.id ? 'Revoking…' : 'Revoke' }}
              </button>
            </div>
            <div
              v-else
              class="row-actions"
            >
              <button
                type="button"
                class="ghost"
                :disabled="busyInviteId === invite.id"
                @click="rotate(invite.id)"
              >
                {{ busyInviteId === invite.id ? 'Working…' : 'New link' }}
              </button>
              <button
                type="button"
                class="ghost"
                @click="revokeConfirmId = invite.id"
              >
                Revoke
              </button>
            </div>
          </li>
        </ul>
      </section>

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
import type { Invite, Member } from '@dostigus/shared'
import { GooseSticker, KitButton, KitSheet } from '@dostigus/ui-kit'

definePageMeta({ layout: 'host' })

useHead({ title: 'Dostigus · Members' })

const { data, error: loadError, refresh } = await useFetch<{ members: Member[] }>('/api/members')
const members = computed(() => data.value?.members ?? [])

const {
  data: inviteData,
  error: inviteLoadError,
  refresh: refreshInvites,
} = await useFetch<{ invites: Invite[] }>('/api/members/invites')
const invites = computed(() => inviteData.value?.invites ?? [])

const { revision } = useHostMemberAdd()
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

const inviteEmail = ref('')
const inviting = ref(false)
const issuedUrl = ref('')
const issuedId = ref('')
const copied = ref(false)
const inviteMessage = ref('')
const inviteMessageError = ref(false)
const busyInviteId = ref('')
const revokeConfirmId = ref('')

function formatExpiry(iso: string): string {
  const date = new Date(iso)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`
}

function isExpired(iso: string): boolean {
  return Date.parse(iso) <= Date.now()
}

function selectLink(event: FocusEvent) {
  const input = event.target
  if (input instanceof HTMLInputElement) {
    input.select()
  }
}

function inviteFailure(error: unknown, fallback: string) {
  const fetchError = error as { data?: { statusMessage?: string }, statusMessage?: string }
  inviteMessage.value = fetchError.data?.statusMessage
    ?? fetchError.statusMessage
    ?? fallback
  inviteMessageError.value = true
}

async function createInvite() {
  inviteMessage.value = ''
  inviteMessageError.value = false
  inviting.value = true
  copied.value = false
  try {
    const issued = await $fetch<{ invite: Invite, url: string }>('/api/members/invites', {
      method: 'POST',
      body: { email: inviteEmail.value.trim() },
    })
    issuedUrl.value = issued.url
    issuedId.value = issued.invite.id
    inviteEmail.value = ''
    await refreshInvites()
  } catch (error) {
    inviteFailure(error, 'Could not create this invite.')
  } finally {
    inviting.value = false
  }
}

async function copyLink() {
  if (!issuedUrl.value) {
    return
  }
  try {
    await navigator.clipboard.writeText(issuedUrl.value)
    copied.value = true
  } catch {
    inviteMessage.value = 'Select the link and copy it.'
    inviteMessageError.value = true
  }
}

async function revoke(id: string) {
  busyInviteId.value = id
  inviteMessage.value = ''
  inviteMessageError.value = false
  try {
    await $fetch(`/api/members/invites/${id}/revoke`, { method: 'POST' })
    if (issuedId.value === id) {
      issuedUrl.value = ''
      issuedId.value = ''
    }
    revokeConfirmId.value = ''
    await refreshInvites()
  } catch (error) {
    inviteFailure(error, 'Could not revoke this invite.')
  } finally {
    busyInviteId.value = ''
  }
}

async function rotate(id: string) {
  busyInviteId.value = id
  inviteMessage.value = ''
  inviteMessageError.value = false
  copied.value = false
  try {
    const issued = await $fetch<{ invite: Invite, url: string }>(`/api/members/invites/${id}/rotate`, {
      method: 'POST',
    })
    issuedUrl.value = issued.url
    issuedId.value = issued.invite.id
    await refreshInvites()
  } catch (error) {
    inviteFailure(error, 'Could not make a new link.')
  } finally {
    busyInviteId.value = ''
  }
}

watch(revision, () => {
  void refresh()
  void refreshInvites()
})

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
    await refreshInvites()
    if (issuedId.value && !invites.value.some((invite) => invite.id === issuedId.value)) {
      issuedUrl.value = ''
      issuedId.value = ''
      copied.value = false
    }
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
  border-radius: var(--radius-card);
  background: var(--card);
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
  border-radius: var(--radius);
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

.invite {
  max-width: 32rem;
  margin: 0 auto 2rem;
}

.invite h2,
.invite h3 {
  margin: 0 0 0.4rem;
  font-size: 1.15rem;
  font-weight: 700;
}

.invite h3 {
  margin-top: 1.4rem;
}

.invite > .hint {
  margin: 0 0 1rem;
}

.invite-form {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
}

.invite-form .field {
  width: 100%;
  margin-bottom: 0.35rem;
}

.link-box {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--card);
}

.copy-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.copy-row input {
  flex: 1;
  min-width: 0;
}
</style>
