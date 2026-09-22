<template>
  <div
    v-if="open"
    class="backdrop"
    role="presentation"
    @click="emit('close')"
  />
  <aside
    class="sheet"
    :class="{ open }"
    role="dialog"
    aria-modal="true"
    aria-label="Sheet"
  >
    <div class="handle" />
    <header class="bar">
      <h2>{{ sheet.title }}</h2>
      <button
        type="button"
        class="close"
        @click="emit('close')"
      >
        Close
      </button>
    </header>
    <div class="empty">
      <p>Nothing in this Sheet yet.</p>
      <p class="muted">
        This space fills in when the Bot has something to show.
      </p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Sheet } from '@dostigus/shared'

defineProps<{
  open: boolean
  sheet: Sheet
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 45%);
  z-index: 20;
}

.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 21;
  background: var(--card);
  border-top: 1px solid var(--line);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  min-height: 42dvh;
  max-height: 80dvh;
  transform: translateY(110%);
  transition: transform 180ms ease;
  padding: 0.5rem 1.25rem 1.5rem;
}

.sheet.open {
  transform: translateY(0);
}

.handle {
  width: 2.5rem;
  height: 0.28rem;
  border-radius: 999px;
  background: var(--line);
  margin: 0.35rem auto 0.75rem;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

.close {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem;
}

.empty {
  color: var(--text);
}

.muted {
  color: var(--text-muted);
}
</style>
