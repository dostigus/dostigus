<template>
  <div class="members">
    <header class="head">
      <div>
        <h1>{{ $t('members.title') }}</h1>
        <p>{{ $t('members.peopleOnHost') }}</p>
      </div>
      <KitButton
        type="button"
        @click="addOpen = true"
      >
        {{ $t('members.addShort') }}
      </KitButton>
    </header>

    <section
      class="card invite"
      :aria-label="$t('members.inviteAria')"
    >
      <h2>{{ $t('members.inviteByEmail') }}</h2>
      <p class="hint">
        {{ $t('members.inviteHint') }}
      </p>
      <form
        class="invite-form"
        @submit.prevent="createInvite"
      >
        <label class="field">
          <span>{{ $t('auth.field.email') }}</span>
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
          {{ inviting ? $t('members.addSheet.creatingInvite') : $t('members.addSheet.createInvite') }}
        </KitButton>
      </form>

      <div
        v-if="issuedUrl"
        class="link-box"
      >
        <p class="hint">
          {{ $t('members.copyOnce') }}
        </p>
        <div class="copy-row">
          <input
            readonly
            :value="issuedUrl"
            :aria-label="$t('members.inviteLink')"
            @focus="selectLink"
          >
          <button
            type="button"
            class="ghost"
            @click="copyLink"
          >
            {{ copied ? $t('members.copied') : $t('members.copy') }}
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

      <h3>{{ $t('members.pending') }}</h3>
      <p
        v-if="inviteLoadError"
        class="banner"
      >
        {{ $t('members.loadInvitesFailed') }}
      </p>
      <p
        v-else-if="invites.length === 0"
        class="meta"
      >
        {{ $t('members.noPending') }}
      </p>
      <ul
        v-else
        class="people"
        :aria-label="$t('members.pendingAria')"
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
              {{ isExpired(invite.expiresAt) ? $t('members.expired') : $t('members.expires') }}
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
              {{ $t('common.cancel') }}
            </button>
            <button
              type="button"
              class="danger"
              :disabled="busyInviteId === invite.id"
              @click="revoke(invite.id)"
            >
              {{ busyInviteId === invite.id ? $t('members.revoking') : $t('members.revoke') }}
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
              {{ busyInviteId === invite.id ? $t('members.working') : $t('members.newLink') }}
            </button>
            <button
              type="button"
              class="ghost"
              @click="revokeConfirmId = invite.id"
            >
              {{ $t('members.revoke') }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <p
      v-if="loadError"
      class="banner"
    >
      {{ $t('members.loadFailed') }}
    </p>

    <section
      v-else-if="members.length === 0"
      class="card empty"
    >
      <GooseSticker
        class="sticker"
        name="peek"
        alt=""
      />
      <p class="kicker">
        {{ $t('members.title') }}
      </p>
      <h2>{{ $t('members.empty') }}</h2>
      <p class="hint">
        {{ $t('members.emptyHint') }}
      </p>
      <KitButton
        type="button"
        @click="addOpen = true"
      >
        {{ $t('members.addShort') }}
      </KitButton>
    </section>

    <ul
      v-else
      class="people list"
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
          {{ $t('members.disabled') }}
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
            {{ $t('common.cancel') }}
          </button>
          <button
            type="button"
            class="danger"
            :disabled="busyId === member.id"
            @click="turnOff(member.id)"
          >
            {{ busyId === member.id ? $t('members.turningOff') : $t('members.disable') }}
          </button>
        </div>
        <button
          v-else
          type="button"
          class="ghost"
          @click="confirmId = member.id"
        >
          {{ $t('members.disable') }}
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
      :title="$t('members.addSheet.title')"
      :description="$t('members.addSheetDescription')"
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
          <span>{{ $t('auth.field.displayName') }}</span>
          <input
            v-model="displayName"
            type="text"
            autocomplete="off"
            required
          >
        </label>

        <label class="field">
          <span>{{ $t('auth.field.login') }}</span>
          <input
            v-model="login"
            type="text"
            autocomplete="off"
            required
          >
        </label>

        <label class="field">
          <span>{{ $t('auth.field.password') }}</span>
          <input
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
            minlength="8"
          >
          <span class="field-hint">{{ $t('auth.field.passwordMin') }}</span>
        </label>

        <label class="field">
          <span>{{ $t('auth.field.confirmPassword') }}</span>
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
            {{ $t('common.cancel') }}
          </KitButton>
          <KitButton
            type="submit"
            :disabled="adding"
          >
            {{ adding ? $t('members.addSheet.submitBusy') : $t('members.addShort') }}
          </KitButton>
        </div>
      </form>
    </KitSheet>
  </div>
</template>

<script setup lang="ts">
import type { Invite, Member } from '@dostigus/shared'
import { GooseSticker, KitButton, KitSheet } from '@dostigus/ui-kit'

const { t } = useI18n()

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
    inviteFailure(error, t('members.inviteFailed'))
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
    inviteMessage.value = t('members.selectAndCopy')
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
    inviteFailure(error, t('members.revokeFailed'))
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
    inviteFailure(error, t('members.rotateFailed'))
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
    message.value = t('auth.error.passwordMismatch')
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
      ?? t('members.addFailed')
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
    message.value = t('members.disableFailed')
    messageError.value = true
  } finally {
    busyId.value = ''
  }
}
</script>

<style scoped>
.members {
  max-width: 34rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.head h1 {
  margin: 0 0 0.35rem;
  font-size: 1.45rem;
}

.head p,
.hint,
.meta {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}

.card {
  padding: 1.5rem 1.45rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--card);
}

.invite h2,
.invite h3,
.empty h2 {
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
  background: var(--bg);
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

.banner {
  margin: 0;
  color: var(--accent);
}

.empty {
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

.empty .hint {
  margin: 0 0 1.2rem;
}

.people {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.people.list {
  margin: 0;
}

.invite .people {
  margin-top: 0.75rem;
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

.invite .person {
  background: var(--bg);
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
  margin: 0;
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
</style>
