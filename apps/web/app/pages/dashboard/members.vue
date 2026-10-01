<template>
  <div class="members">
    <header class="head">
      <div>
        <h1>{{ $t('members.title') }}</h1>
        <p>{{ $t('members.peopleOnHost') }}</p>
      </div>
      <KitButton
        v-if="isOwner"
        type="button"
        @click="addOpen = true"
      >
        {{ $t('members.addShort') }}
      </KitButton>
    </header>

    <KitPanel
      class="invite"
      :title="$t('members.inviteByEmail')"
      :description="$t('members.inviteHint')"
    >
      <form
        class="invite-form"
        @submit.prevent="createInvite"
      >
        <KitField
          class="wide"
          :label="$t('auth.field.email')"
          :error="inviteError || undefined"
          required
        >
          <KitInput
            v-model="inviteEmail"
            type="email"
            autocomplete="off"
          />
        </KitField>
        <KitButton
          type="submit"
          :disabled="inviting"
        >
          {{ inviting ? $t('members.addSheet.creatingInvite') : $t('members.addSheet.createInvite') }}
        </KitButton>
      </form>

      <KitField
        v-if="issuedUrl"
        :label="$t('members.inviteLink')"
        :hint="$t('members.copyOnce')"
        :error="copyError || undefined"
      >
        <div class="copy-row">
          <KitInput
            class="grow"
            :model-value="issuedUrl"
            readonly
            @focus="selectLink"
          />
          <KitButton
            variant="ghost"
            @click="copyLink"
          >
            {{ copied ? $t('members.copied') : $t('members.copy') }}
          </KitButton>
        </div>
      </KitField>

      <h3 class="subhead">
        {{ $t('members.pending') }}
      </h3>
      <p
        v-if="inviteLoadError"
        class="note"
        role="alert"
      >
        <KitChip tone="warn">
          {{ $t('members.loadInvitesFailed') }}
        </KitChip>
      </p>
      <p
        v-else-if="invites.length === 0"
        class="hint"
      >
        {{ $t('members.noPending') }}
      </p>
      <ul
        v-else
        class="rows"
        :aria-label="$t('members.pendingAria')"
      >
        <KitListRow
          v-for="invite in invites"
          :key="invite.id"
          as="li"
          :title="invite.email"
          :subtitle="`${isExpired(invite.expiresAt) ? $t('members.expired') : $t('members.expires')} ${formatExpiry(invite.expiresAt)}`"
        >
          <template #trailing>
            <template v-if="revokeConfirmId === invite.id">
              <KitButton
                variant="ghost"
                size="sm"
                @click="revokeConfirmId = ''"
              >
                {{ $t('common.cancel') }}
              </KitButton>
              <KitButton
                size="sm"
                :disabled="busyInviteId === invite.id"
                @click="revoke(invite.id)"
              >
                {{ busyInviteId === invite.id ? $t('members.revoking') : $t('members.revoke') }}
              </KitButton>
            </template>
            <template v-else>
              <KitButton
                variant="ghost"
                size="sm"
                :disabled="busyInviteId === invite.id"
                @click="rotate(invite.id)"
              >
                {{ busyInviteId === invite.id ? $t('members.working') : $t('members.newLink') }}
              </KitButton>
              <KitButton
                variant="ghost"
                size="sm"
                @click="revokeConfirmId = invite.id"
              >
                {{ $t('members.revoke') }}
              </KitButton>
            </template>
          </template>
        </KitListRow>
      </ul>
      <p
        v-if="inviteMessage"
        class="note"
        role="alert"
      >
        <KitChip tone="warn">
          {{ inviteMessage }}
        </KitChip>
      </p>
    </KitPanel>

    <p
      v-if="loadError"
      class="note"
      role="alert"
    >
      <KitChip tone="warn">
        {{ $t('members.loadFailed') }}
      </KitChip>
    </p>

    <KitPanel
      v-else-if="members.length === 0"
      class="empty"
    >
      <div class="empty-body">
        <GooseSticker
          name="peek"
          alt=""
        />
        <h2>{{ $t('members.empty') }}</h2>
        <p class="hint">
          {{ $t('members.emptyHint') }}
        </p>
        <KitButton
          v-if="isOwner"
          type="button"
          @click="addOpen = true"
        >
          {{ $t('members.addShort') }}
        </KitButton>
      </div>
    </KitPanel>

    <KitPanel v-else>
      <ul
        class="rows"
        :aria-label="$t('members.title')"
      >
        <KitListRow
          v-for="member in members"
          :key="member.id"
          as="li"
          :title="member.displayName"
          :subtitle="member.email ?? member.username ?? undefined"
        >
          <template #trailing>
            <KitChip v-if="member.role === 'admin'">
              {{ $t('members.roleAdmin') }}
            </KitChip>
            <KitChip v-if="member.disabledAt">
              {{ $t('members.disabled') }}
            </KitChip>
            <template v-else-if="isOwner && confirmId === member.id">
              <KitButton
                variant="ghost"
                size="sm"
                @click="confirmId = ''"
              >
                {{ $t('common.cancel') }}
              </KitButton>
              <KitButton
                size="sm"
                :disabled="busyId === member.id"
                @click="turnOff(member.id)"
              >
                {{ busyId === member.id ? $t('members.turningOff') : $t('members.disable') }}
              </KitButton>
            </template>
            <template v-else-if="isOwner">
              <KitButton
                variant="ghost"
                size="sm"
                :disabled="busyId === member.id"
                @click="setRole(member)"
              >
                {{ roleButtonLabel(member) }}
              </KitButton>
              <KitButton
                variant="ghost"
                size="sm"
                @click="confirmId = member.id"
              >
                {{ $t('members.disable') }}
              </KitButton>
            </template>
          </template>
        </KitListRow>
      </ul>
    </KitPanel>

    <p
      v-if="message && !addOpen"
      class="note"
      :role="messageError ? 'alert' : 'status'"
    >
      <KitChip :tone="messageError ? 'warn' : 'ok'">
        {{ message }}
      </KitChip>
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
      <form
        class="add-form"
        @submit.prevent="add"
      >
        <KitField
          :label="$t('auth.field.displayName')"
          :error="addErrors.displayName"
          required
        >
          <KitInput
            v-model="displayName"
            autocomplete="off"
          />
        </KitField>

        <KitField
          :label="$t('auth.field.login')"
          :error="addErrors.login"
          required
        >
          <KitInput
            v-model="login"
            autocomplete="off"
          />
        </KitField>

        <KitField
          :label="$t('auth.field.password')"
          :hint="$t('auth.field.passwordMin')"
          :error="addErrors.password"
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
          :error="addErrors.confirm"
          required
        >
          <KitInput
            v-model="confirm"
            type="password"
            autocomplete="new-password"
            minlength="8"
          />
        </KitField>

        <div class="actions">
          <p
            v-if="addErrors.form"
            class="note form-error"
            role="alert"
          >
            <KitChip tone="warn">
              {{ addErrors.form }}
            </KitChip>
          </p>
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
import type { MemberFormField } from '../../utils/member-form'
import { GooseSticker, KitButton, KitChip, KitField, KitInput, KitListRow, KitPanel, KitSheet } from '@dostigus/ui-kit'
import { hostStatusCopy } from '../../utils/host-status-copy'
import { memberErrorField } from '../../utils/member-form'

const { t } = useI18n()
const { isOwner } = useHostAccount()

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
const addErrors = ref<Partial<Record<MemberFormField | 'confirm', string>>>({})
const busyId = ref('')
const roleBusy = ref(false)
const confirmId = ref('')
const message = ref('')
const messageError = ref(false)

const inviteEmail = ref('')
const inviting = ref(false)
const inviteError = ref('')
const issuedUrl = ref('')
const issuedId = ref('')
const copied = ref(false)
const copyError = ref('')
const inviteMessage = ref('')
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

function inviteFailure(error: unknown, fallbackKey: string) {
  inviteMessage.value = hostStatusCopy(error, t, fallbackKey)
}

async function createInvite() {
  inviteMessage.value = ''
  inviteError.value = ''
  copyError.value = ''
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
    inviteError.value = hostStatusCopy(error, t, 'members.inviteFailed')
  } finally {
    inviting.value = false
  }
}

async function copyLink() {
  if (!issuedUrl.value) {
    return
  }
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(issuedUrl.value)
    copied.value = true
  } catch {
    copyError.value = t('members.selectAndCopy')
  }
}

async function revoke(id: string) {
  busyInviteId.value = id
  inviteMessage.value = ''
  try {
    await $fetch(`/api/members/invites/${id}/revoke`, { method: 'POST' })
    if (issuedId.value === id) {
      issuedUrl.value = ''
      issuedId.value = ''
      copyError.value = ''
    }
    revokeConfirmId.value = ''
    await refreshInvites()
  } catch (error) {
    inviteFailure(error, 'members.revokeFailed')
  } finally {
    busyInviteId.value = ''
  }
}

async function rotate(id: string) {
  busyInviteId.value = id
  inviteMessage.value = ''
  copyError.value = ''
  copied.value = false
  try {
    const issued = await $fetch<{ invite: Invite, url: string }>(`/api/members/invites/${id}/rotate`, {
      method: 'POST',
    })
    issuedUrl.value = issued.url
    issuedId.value = issued.invite.id
    await refreshInvites()
  } catch (error) {
    inviteFailure(error, 'members.rotateFailed')
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
    addErrors.value = {}
  }
})

async function add() {
  message.value = ''
  messageError.value = false
  addErrors.value = {}
  if (password.value !== confirm.value) {
    addErrors.value = { confirm: t('auth.error.passwordMismatch') }
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
    addOpen.value = false
    await refresh()
    await refreshInvites()
    if (issuedId.value && !invites.value.some((invite) => invite.id === issuedId.value)) {
      issuedUrl.value = ''
      issuedId.value = ''
      copied.value = false
    }
  } catch (error) {
    addErrors.value = { [memberErrorField(error)]: hostStatusCopy(error, t, 'members.addFailed') }
  } finally {
    adding.value = false
  }
}

function roleButtonLabel(member: Member): string {
  if (busyId.value === member.id && roleBusy.value) {
    return t('members.roleSaving')
  }
  return member.role === 'admin' ? t('members.removeAdmin') : t('members.makeAdmin')
}

async function setRole(member: Member) {
  busyId.value = member.id
  roleBusy.value = true
  message.value = ''
  messageError.value = false
  try {
    await $fetch(`/api/members/${member.id}/role`, {
      method: 'PUT',
      body: { role: member.role === 'admin' ? 'member' : 'admin' },
    })
    await refresh()
  } catch {
    message.value = t('members.roleFailed')
    messageError.value = true
  } finally {
    busyId.value = ''
    roleBusy.value = false
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
.hint {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}

.note {
  margin: 0;
}

.invite-form {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.9rem;
}

.wide {
  align-self: stretch;
}

.copy-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.grow {
  flex: 1;
}

.subhead {
  margin: 0.5rem 0 0;
  font-size: 1rem;
  font-weight: 700;
}

.rows {
  list-style: none;
  margin: 0 -0.7rem;
  padding: 0;
}

.rows > li + li {
  border-top: 1px solid var(--line-soft);
}

.empty-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
}

.empty-body h2 {
  margin: 0;
  font-size: 1.15rem;
}

.empty-body .hint {
  margin-bottom: 0.6rem;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.35rem;
}

.form-error {
  margin-right: auto;
}
</style>
