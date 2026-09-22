<template>
  <KitDialog
    v-model:open="dialogOpen"
    title="Create Bot"
    description="Give it a name. Chat will ask what it is for."
  >
    <template #media>
      <GooseSticker
        name="ok"
        size="sm"
        alt=""
      />
    </template>
    <form @submit.prevent="create">
      <label class="field">
        <span>Name</span>
        <input
          v-model="name"
          type="text"
          maxlength="120"
          :placeholder="defaultName"
          autocomplete="off"
        >
      </label>
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
      <div class="actions">
        <KitButton
          variant="ghost"
          type="button"
          @click="dialogOpen = false"
        >
          Cancel
        </KitButton>
        <KitButton
          type="submit"
          :disabled="busy"
        >
          {{ busy ? 'Creating…' : 'Create' }}
        </KitButton>
      </div>
    </form>
  </KitDialog>
</template>

<script setup lang="ts">
import type { Bot } from '@dostigus/shared'
import { DEFAULT_BOT_NAME } from '@dostigus/shared'
import { GooseSticker, KitButton, KitDialog } from '@dostigus/ui-kit'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  created: [bot: Bot]
}>()

const defaultName = DEFAULT_BOT_NAME
const name = ref('')
const busy = ref(false)
const error = ref('')
const dialogOpen = ref(false)

watch(() => props.open, (value) => {
  dialogOpen.value = value
  if (value) {
    name.value = ''
    error.value = ''
    busy.value = false
  }
}, { immediate: true })

watch(dialogOpen, (value) => {
  if (!value && props.open) {
    emit('close')
  }
})

async function create() {
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<{ bot: Bot }>('/api/bots', {
      method: 'POST',
      body: { name: name.value.trim() || defaultName },
    })
    emit('created', result.bot)
  } catch {
    error.value = 'Could not create Bot.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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

.error {
  margin: 0.7rem 0 0;
  color: var(--accent);
  font-size: 0.85rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.1rem;
}
</style>
