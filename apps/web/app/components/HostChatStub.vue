<template>
  <section class="chat" aria-label="Chat">
    <div class="empty">
      <p class="kicker">
        Chat
      </p>
      <h1>No messages yet</h1>
      <p class="hint">
        A Bot will talk here. Cards and Sheets open from this thread — not a
        separate site.
      </p>
      <button
        type="button"
        class="ghost"
        @click="emit('openSheet')"
      >
        Open Sheet stub
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  openSheet: []
}>()
</script>

<style scoped>
.chat {
  flex: 1;
  background: var(--bg-chat);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.25rem 6rem;
}

.empty {
  max-width: 26rem;
  text-align: center;
}

.kicker {
  margin: 0 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent);
}

h1 {
  margin: 0 0 0.6rem;
  font-size: 1.6rem;
  font-weight: 600;
}

.hint {
  margin: 0 0 1.25rem;
  color: var(--muted);
  line-height: 1.45;
}

.ghost {
  appearance: none;
  border: 1px solid var(--accent-dim);
  background: transparent;
  color: var(--ink);
  padding: 0.55rem 1rem;
  border-radius: 999px;
  cursor: pointer;
}

.ghost:hover {
  border-color: var(--accent);
}
</style>
