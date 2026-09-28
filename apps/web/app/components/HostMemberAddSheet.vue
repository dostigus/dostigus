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
      <header class="block-head">
        <h3>{{ $t('members.inviteByEmail') }}</h3>
        <p class="hint">
          {{ $t('members.inviteHint') }}
        </p>
      </header>
      <KitField
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
      <div class="actions start">
        <KitButton
          type="submit"
          :disabled="inviting"
        >
          {{ inviting ? $t('members.addSheet.creatingInvite') : $t('members.addSheet.createInvite') }}
        </KitButton>
      </div>

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
    </form>

    <form
      class="block"
      @submit.prevent="add"
    >
      <h3>{{ $t('members.orWithPassword') }}</h3>
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
          class="error"
          role="alert"
        >
          {{ addErrors.form }}
        </p>
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
import type { MemberFormField } from '../utils/member-form'
import { GooseSticker, KitButton, KitField, KitInput, KitSheet } from '@dostigus/ui-kit'
import { hostStatusCopy } from '../utils/host-status-copy'
import { memberErrorField } from '../utils/member-form'

const open = defineModel<boolean>('open', { required: true })
const { noteMembersChanged } = useHostMemberAdd()
const { t } = useI18n()

const inviteEmail = ref('')
const inviting = ref(false)
const inviteError = ref('')
const issuedUrl = ref('')
const copied = ref(false)
const copyError = ref('')

const displayName = ref('')
const login = ref('')
const password = ref('')
const confirm = ref('')
const adding = ref(false)
const addErrors = ref<Partial<Record<MemberFormField | 'confirm', string>>>({})

watch(open, (isOpen) => {
  if (!isOpen) {
    return
  }
  addErrors.value = {}
  inviteError.value = ''
  copyError.value = ''
})

function selectLink(event: FocusEvent) {
  const input = event.target
  if (input instanceof HTMLInputElement) {
    input.select()
  }
}

async function createInvite() {
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
    inviteEmail.value = ''
    noteMembersChanged()
  } catch (error) {
    inviteError.value = hostStatusCopy(error, t, 'members.addSheet.inviteFailed')
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

async function add() {
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
    noteMembersChanged()
    open.value = false
  } catch (error) {
    addErrors.value = { [memberErrorField(error)]: hostStatusCopy(error, t, 'members.addSheet.addFailed') }
  } finally {
    adding.value = false
  }
}
</script>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.block + .block {
  margin-top: 1.25rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--line);
}

.block-head {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

h3 {
  margin: 0;
  font-size: 1rem;
}

.hint,
.error {
  margin: 0;
  line-height: 1.45;
}

.hint {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.error {
  margin-right: auto;
  color: var(--accent);
  font-size: 0.88rem;
  font-weight: 600;
}

.copy-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.grow {
  flex: 1;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
}

.actions.start {
  justify-content: flex-start;
}
</style>
