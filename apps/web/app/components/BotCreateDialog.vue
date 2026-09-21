<template>
  <div
    v-if="open"
    class="backdrop"
    role="presentation"
    @click="emit('close')"
  />
  <aside
    v-if="open"
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-label="Create Bot"
  >
    <h2>Create Bot</h2>
    <p class="hint">
      Give it a name. Chat will ask what it is for.
    </p>
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
        <button
          type="button"
          class="ghost"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="solid"
          :disabled="busy"
        >
          {{ busy ? 'Creating…' : 'Create' }}
        </button>
      </div>
    </form>
  </aside>
</template>

<script setup lang="ts">
import type { Bot } from '@dostigus/shared'
import { DEFAULT_BOT_NAME } from '@dostigus/shared'

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

watch(() => props.open, (open) => {
  if (open) {
    name.value = ''
    error.value = ''
    busy.value = false
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
.backdrop {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 45%);
  z-index: 20;
}

.dialog {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 21;
  transform: translate(-50%, -50%);
  width: min(22rem, calc(100vw - 2rem));
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1.35rem 1.4rem 1.4rem;
}

h2 {
  margin: 0 0 0.4rem;
  font-size: 1.15rem;
}

.hint {
  margin: 0 0 1rem;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.4;
}

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

.ghost,
.solid {
  appearance: none;
  border-radius: 999px;
  padding: 0.45rem 0.95rem;
  cursor: pointer;
}

.ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
}

.solid {
  border: 0;
  background: var(--accent);
  color: var(--accent-ink);
}

.solid:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>
