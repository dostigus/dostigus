<template>
  <KitSheet
    v-model:open="open"
    edge="end"
    title="Bot"
    description="Name and Model tier."
  >
    <form
      v-if="isOwner && bot"
      class="form"
      @submit.prevent="save"
    >
      <label class="field">
        <span>Name</span>
        <input
          v-model="name"
          type="text"
          maxlength="120"
          autocomplete="off"
          required
        >
      </label>
      <label class="field">
        <span>Model tier</span>
        <select v-model="tier">
          <option
            v-for="item in tiers"
            :key="item"
            :value="item"
          >
            {{ MODEL_TIER_LABELS[item] }}
          </option>
        </select>
      </label>
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
      <KitButton
        type="submit"
        :disabled="saving || !name.trim()"
      >
        {{ saving ? 'Saving…' : 'Save' }}
      </KitButton>
    </form>

    <dl
      v-else-if="bot"
      class="read"
    >
      <dt>Name</dt>
      <dd>{{ bot.name }}</dd>
      <dt>Model tier</dt>
      <dd>{{ MODEL_TIER_LABELS[bot.manifest.modelTier] }}</dd>
    </dl>

    <div
      v-if="isOwner && bot"
      class="danger"
    >
      <p>Delete this Bot and its Chat.</p>
      <div
        v-if="confirmDelete"
        class="row"
      >
        <button
          type="button"
          class="ghost"
          :disabled="deleting"
          @click="confirmDelete = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="danger-btn"
          :disabled="deleting"
          @click="remove"
        >
          {{ deleting ? 'Deleting…' : 'Confirm delete' }}
        </button>
      </div>
      <button
        v-else
        type="button"
        class="danger-btn"
        :disabled="deleting || saving"
        @click="confirmDelete = true"
      >
        Delete
      </button>
    </div>
  </KitSheet>
</template>

<script setup lang="ts">
import type { Bot, ModelTier } from '@dostigus/shared'
import { MODEL_TIER_LABELS, MODEL_TIERS } from '@dostigus/shared'
import { KitButton, KitSheet } from '@dostigus/ui-kit'

const props = defineProps<{
  bot: Bot | undefined
}>()

const emit = defineEmits<{
  saved: []
  deleted: []
}>()

const open = defineModel<boolean>('open', { required: true })

const { isOwner } = useHostAccount()
const tiers = MODEL_TIERS
const name = ref('')
const tier = ref<ModelTier>('strong')
const saving = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const error = ref('')

watch(() => props.bot?.id, () => {
  syncFromBot()
})

watch(open, (isOpen) => {
  if (isOpen) {
    syncFromBot()
    return
  }
  confirmDelete.value = false
  error.value = ''
})

function syncFromBot() {
  if (!props.bot) {
    return
  }
  name.value = props.bot.name
  tier.value = props.bot.manifest.modelTier
  error.value = ''
  confirmDelete.value = false
}

async function save() {
  if (!props.bot || !isOwner.value || saving.value) {
    return
  }
  const nextName = name.value.trim()
  if (!nextName) {
    return
  }
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/bots/${props.bot.id}`, {
      method: 'PATCH',
      body: { name: nextName, modelTier: tier.value },
    })
    emit('saved')
  } catch {
    error.value = 'Could not save this Bot.'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.bot || !isOwner.value || deleting.value) {
    return
  }
  deleting.value = true
  error.value = ''
  try {
    await $fetch(`/api/bots/${props.bot.id}`, { method: 'DELETE' })
    emit('deleted')
  } catch {
    error.value = 'Could not delete this Bot.'
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.form,
.read {
  margin: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
  font-size: 0.82rem;
  color: var(--text-muted);
}

input,
select {
  appearance: none;
  width: 100%;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.75rem;
  font: inherit;
  font-size: 1rem;
}

input:focus,
select:focus {
  outline: 1px solid var(--accent-dim);
}

.read dt {
  margin: 0.85rem 0 0.2rem;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.read dd {
  margin: 0;
  font-weight: 700;
}

.error {
  margin: 0 0 0.75rem;
  color: var(--accent);
  font-size: 0.88rem;
}

.danger {
  margin-top: 1.4rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}

.danger p {
  margin: 0 0 0.75rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ghost,
.danger-btn {
  appearance: none;
  border-radius: 999px;
  padding: 0.55rem 0.95rem;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text-muted);
}

.danger-btn {
  border: 1px solid var(--accent-dim);
  background: transparent;
  color: var(--accent);
}

.ghost:disabled,
.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
