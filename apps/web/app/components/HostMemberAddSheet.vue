<template>
  <KitSheet
    v-model:open="open"
    :title="$t('members.addSheet.title')"
    :description="$t('members.addSheetInviteHint')"
  >
    <template #media>
      <GooseSticker
        name="ok"
        size="sm"
        alt=""
      />
    </template>

    <form
      class="block"
      @submit.prevent="createInvite"
    >
      <h3>{{ $t('members.inviteByEmail') }}</h3>
      <p class="hint">
        {{ $t('members.inviteHint') }}
      </p>
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
    </form>

    <form
      class="block"
      @submit.prevent="add"
    >
      <h3>{{ $t('members.orWithPassword') }}</h3>
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
        v-if="message"
        class="flash"
        :class="{ error: messageError }"
      >
        {{ message }}
      </p>
      <div class="actions">
        <KitButton
          variant="ghost"
          type="button"
          @click="open = false"
        >
          {{ $t('kit.close') }}
        </KitButton>
        <KitButton
          type="submit"
          :disabled="adding"
        >
          {{ adding ? $t('members.addSheet.submitBusy') : $t('members.addSheet.submit') }}
        </KitButton>
      </div>
    </form>
  </KitSheet>
</template>

<script setup lang="ts">
import type { Invite } from '@dostigus/shared'
import { GooseSticker, KitButton, KitSheet } from '@dostigus/ui-kit'

const open = defineModel<boolean>('open', { required: true })
const { noteMembersChanged } = useHostMemberAdd()
const { t } = useI18n()

const inviteEmail = ref('')
const inviting = ref(false)
const issuedUrl = ref('')
const copied = ref(false)
const inviteMessage = ref('')
const inviteMessageError = ref(false)

const displayName = ref('')
const login = ref('')
const password = ref('')
const confirm = ref('')
const adding = ref(false)
const message = ref('')
const messageError = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) {
    return
  }
  message.value = ''
  messageError.value = false
  inviteMessage.value = ''
  inviteMessageError.value = false
})

function selectLink(event: FocusEvent) {
  const input = event.target
  if (input instanceof HTMLInputElement) {
    input.select()
  }
}

function failure(error: unknown, fallback: string): string {
  const fetchError = error as { data?: { statusMessage?: string }, statusMessage?: string }
  return fetchError.data?.statusMessage
    ?? fetchError.statusMessage
    ?? fallback
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
    inviteEmail.value = ''
    noteMembersChanged()
  } catch (error) {
    inviteMessage.value = failure(error, t('members.addSheet.inviteFailed'))
    inviteMessageError.value = true
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
    message.value = t('members.added')
    messageError.value = false
    noteMembersChanged()
    open.value = false
  } catch (error) {
    message.value = failure(error, t('members.addSheet.addFailed'))
    messageError.value = true
  } finally {
    adding.value = false
  }
}
</script>

<style scoped>
.block + .block {
  margin-top: 1.25rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--line);
}

h3 {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}

.hint,
.field-hint,
.flash {
  margin: 0;
  line-height: 1.45;
}

.hint,
.field-hint {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0.75rem 0;
}

.field span {
  font-size: 0.82rem;
  color: var(--text-muted);
}

input {
  font: inherit;
  color: inherit;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 0.55rem 0.7rem;
}

.link-box {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.85rem;
}

.copy-row {
  display: flex;
  gap: 0.45rem;
}

.copy-row input {
  flex: 1;
  min-width: 0;
}

.ghost {
  appearance: none;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.flash {
  margin-top: 0.75rem;
}

.error {
  color: var(--accent);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.4rem;
}
</style>
